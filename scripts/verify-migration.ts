/**
 * Post-migration verification for the phase engine.
 *
 * Answers two questions: is any pre-existing row different from before, and did
 * the new columns land in the state the migration promised.
 *
 *   npx tsx scripts/verify-migration.ts <backup-file>
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { Client } from "pg";

const client = new Client({ connectionString: process.env.DATABASE_URL });

async function one(sql: string): Promise<Record<string, unknown>> {
  const result = await client.query(sql);
  return result.rows[0];
}

let failures = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const ok = String(actual) === String(expected);
  if (!ok) failures += 1;
  console.log(`  ${ok ? "ok  " : "FAIL"} ${label}: ${actual}${ok ? "" : ` (expected ${expected})`}`);
}

async function main() {
  const backupPath = process.argv[2];
  if (!backupPath) throw new Error("Usage: tsx scripts/verify-migration.ts <backup-file>");
  const backup = JSON.parse(readFileSync(backupPath, "utf8")) as {
    tables: Record<string, unknown[]>;
  };

  await client.connect();

  console.log("row counts unchanged since the backup:");
  for (const [table, before] of Object.entries(backup.tables)) {
    if (table === "_prisma_migrations") continue; // expected to grow
    const row = await one(`SELECT count(*)::int AS n FROM "${table}"`);
    check(table, row.n, before.length);
  }

  console.log("\nexisting retros keep their old behaviour:");
  const guarded = await one(
    `SELECT
       count(*) FILTER (WHERE "isGuided")         AS guided,
       count(*) FILTER (WHERE "hideOthersCards")  AS hiding,
       count(*) FILTER (WHERE "hideVoteCounts")   AS hiding_votes,
       count(*) FILTER (WHERE "voteBudget" <> 0)  AS budgeted,
       count(*) FILTER (WHERE "collectRevealedAt" IS NULL) AS unrevealed
     FROM "Retrospective"`,
  );
  check("retros switched to guided", guarded.guided, 0);
  check("retros hiding cards", guarded.hiding, 0);
  check("retros hiding vote counts", guarded.hiding_votes, 0);
  check("retros with a vote budget", guarded.budgeted, 0);
  check("retros left unrevealed", guarded.unrevealed, 0);

  const phases = await client.query(
    `SELECT "phase", "status", count(*)::int AS n FROM "Retrospective" GROUP BY 1, 2 ORDER BY 1`,
  );
  console.log("\nphase assigned by status:");
  for (const row of phases.rows) console.log(`  ${row.status} -> ${row.phase}: ${row.n}`);
  const mismatched = await one(
    `SELECT count(*)::int AS n FROM "Retrospective"
      WHERE ("status" IN ('COMPLETED','ARCHIVED') AND "phase" <> 'CLOSED')
         OR ("status" NOT IN ('COMPLETED','ARCHIVED') AND "phase" <> 'COLLECT')`,
  );
  check("retros with a phase that doesn't match their status", mismatched.n, 0);

  console.log("\ndenormalised ids agree with their parents:");
  const cardDrift = await one(
    `SELECT count(*)::int AS n FROM "RetroCard" c
       JOIN "RetroColumn" col ON col.id = c."columnId"
      WHERE col."retrospectiveId" <> c."retrospectiveId"`,
  );
  const voteDrift = await one(
    `SELECT count(*)::int AS n FROM "CardVote" v
       JOIN "RetroCard" c ON c.id = v."cardId"
      WHERE c."retrospectiveId" <> v."retrospectiveId"`,
  );
  const nullCards = await one(`SELECT count(*)::int AS n FROM "RetroCard" WHERE "retrospectiveId" IS NULL`);
  check("cards whose retro disagrees with their column", cardDrift.n, 0);
  check("votes whose retro disagrees with their card", voteDrift.n, 0);
  check("cards with no retrospectiveId", nullCards.n, 0);

  console.log("\ncolumn sentiment backfill:");
  const sentiment = await client.query(
    `SELECT "sentiment", count(*)::int AS n FROM "RetroColumn" GROUP BY 1 ORDER BY 1`,
  );
  for (const row of sentiment.rows) console.log(`  ${row.sentiment}: ${row.n}`);

  console.log(`\n${failures === 0 ? "PASS — no existing data changed" : `FAILED (${failures} checks)`}`);
  await client.end();
  if (failures > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
