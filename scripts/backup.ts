/**
 * Logical backup of every table, as JSON.
 *
 * Not a substitute for pg_dump — it captures rows, not schema, sequences or
 * permissions — but pg_dump isn't available on every machine that needs to run
 * a migration, and this database is small enough that a row-level snapshot is
 * a genuine restore path rather than a gesture.
 *
 *   npx tsx scripts/backup.ts <output-file>
 */
import "dotenv/config";
import { writeFileSync } from "node:fs";
import { Client } from "pg";

// Parents before children, so a restore can insert in this order.
const TABLES = [
  "User",
  "Company",
  "CompanyMembership",
  "Project",
  "ProjectMembership",
  "Invitation",
  "LoginToken",
  "Retrospective",
  "RetroColumn",
  "RetroCard",
  "CardVote",
  "ActionItem",
  "ActionItemAssignee",
  "Comment",
  "Reaction",
  "_prisma_migrations",
];

async function main() {
  const outputPath = process.argv[2];
  if (!outputPath) throw new Error("Usage: tsx scripts/backup.ts <output-file>");

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const target = new URL(process.env.DATABASE_URL ?? "");
  const dump: Record<string, unknown[]> = {};

  for (const table of TABLES) {
    const exists = await client.query(
      `SELECT to_regclass($1) IS NOT NULL AS present`,
      [`public."${table}"`],
    );
    if (!exists.rows[0].present) {
      console.log(`  (skipped ${table} — not present)`);
      continue;
    }
    const result = await client.query(`SELECT * FROM "${table}"`);
    dump[table] = result.rows;
    console.log(`  ${table}: ${result.rows.length}`);
  }

  writeFileSync(
    outputPath,
    JSON.stringify(
      { takenAt: new Date().toISOString(), database: `${target.hostname}${target.pathname}`, tables: dump },
      null,
      2,
    ),
  );
  console.log(`\nwritten to ${outputPath}`);

  await client.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
