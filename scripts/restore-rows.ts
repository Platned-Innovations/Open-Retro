/**
 * Restores rows from a backup, converging each one on exactly what the backup
 * holds. Idempotent: running it twice changes nothing the second time.
 *
 *   npx tsx scripts/restore-rows.ts <backup-file> <Table> [<Table> ...]
 *
 * The timestamp handling is the whole trick. backup.ts serialises through JSON,
 * so a DateTime becomes an ISO string with a `Z`. Every timestamp column in
 * this schema is `TIMESTAMP(3)` — *without* time zone — so handing that string
 * straight back to Postgres discards the offset and stores the UTC wall-clock
 * reading as if it were local: every value silently shifts by the machine's
 * offset from UTC. Converting to a Date first makes node-pg serialise it in
 * local time, which is the same round trip Prisma does when the app writes the
 * row, so the value lands back exactly where it started.
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { Client } from "pg";

const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

function toParameter(value: unknown): unknown {
  return typeof value === "string" && ISO_TIMESTAMP.test(value) ? new Date(value) : value;
}

async function main() {
  const [backupPath, ...tables] = process.argv.slice(2);
  if (!backupPath || tables.length === 0) {
    throw new Error("Usage: tsx scripts/restore-rows.ts <backup-file> <Table> [<Table> ...]");
  }

  const backup = JSON.parse(readFileSync(backupPath, "utf8")) as {
    takenAt: string;
    tables: Record<string, Record<string, unknown>[]>;
  };

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const target = new URL(process.env.DATABASE_URL ?? "");
  console.log(`database: ${target.hostname}${target.pathname}`);
  console.log(`backup taken: ${backup.takenAt}\n`);

  try {
    for (const table of tables) {
      const rows = backup.tables[table];
      if (!rows) throw new Error(`No "${table}" in the backup`);
      if (rows.length === 0) {
        console.log(`  ${table} — nothing in the backup`);
        continue;
      }

      const columns = Object.keys(rows[0]);
      const quoted = columns.map((c) => `"${c}"`).join(", ");
      const placeholders = columns.map((_, i) => `$${i + 1}`).join(", ");
      // A row that is already present is brought back into line rather than
      // skipped, so a partial or mis-typed earlier restore converges instead of
      // leaving the table half right.
      const updates = columns
        .filter((c) => c !== "id")
        .map((c) => `"${c}" = EXCLUDED."${c}"`)
        .join(", ");

      let inserted = 0;
      for (const row of rows) {
        const result = await client.query(
          `INSERT INTO "${table}" (${quoted}) VALUES (${placeholders})
             ON CONFLICT (id) DO UPDATE SET ${updates}`,
          columns.map((c) => toParameter(row[c])),
        );
        inserted += result.rowCount ?? 0;
      }

      const [{ n }] = (
        await client.query(`SELECT count(*)::int AS n FROM "${table}"`)
      ).rows as { n: number }[];
      console.log(
        `  ${table} — wrote ${inserted} of ${rows.length}; table now holds ${n}`,
      );
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
