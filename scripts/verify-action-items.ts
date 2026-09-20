/**
 * Verifies the `done` -> `status` backfill row by row.
 *
 * compare-rows.ts can only say that ActionItem changed, because `done` was
 * deliberately dropped. This says *how* it changed, and that nothing else did.
 *
 *   npx tsx scripts/verify-action-items.ts <backup-file>
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { Client } from "pg";

async function main() {
  const backupPath = process.argv[2];
  if (!backupPath) throw new Error("Usage: tsx scripts/verify-action-items.ts <backup-file>");

  const backup = JSON.parse(readFileSync(backupPath, "utf8")) as {
    tables: { ActionItem: Record<string, unknown>[] };
  };
  const before = new Map(backup.tables.ActionItem.map((row) => [String(row.id), row]));

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const now = (
    await client.query(
      `SELECT id, "status", "completedAt", "description", "retrospectiveId", "createdById", "dueDate"
         FROM "ActionItem"`,
    )
  ).rows;

  let problems = 0;
  for (const row of now) {
    const old = before.get(String(row.id));
    if (!old) {
      console.log(`  unexpected new row: ${row.id}`);
      problems += 1;
      continue;
    }

    const expectedStatus = old.done ? "DONE" : "OPEN";
    const issues: string[] = [];
    if (row.status !== expectedStatus) issues.push(`status ${row.status}, expected ${expectedStatus}`);
    if (Boolean(old.done) !== (row.completedAt !== null)) issues.push("completedAt doesn't match done");
    if (row.description !== old.description) issues.push("description changed");
    if (row.retrospectiveId !== old.retrospectiveId) issues.push("retrospectiveId changed");
    if (row.createdById !== old.createdById) issues.push("createdById changed");

    if (issues.length > 0) {
      console.log(`  ${row.id}: ${issues.join("; ")}`);
      problems += 1;
    }
  }

  const missing = [...before.keys()].filter((id) => !now.some((row) => String(row.id) === id));
  for (const id of missing) {
    console.log(`  row disappeared: ${id}`);
    problems += 1;
  }

  console.log(`\nchecked ${now.length} action items (${before.size} in the backup)`);
  console.log(
    problems === 0
      ? "PASS — every done flag mapped to the right status, and nothing else moved"
      : `FAILED (${problems} problems)`,
  );

  await client.end();
  if (problems > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
