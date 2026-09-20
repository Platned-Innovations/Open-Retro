/**
 * Read-only pre-flight for the phase-engine migration.
 *
 * Checks the things that would either abort the migration half-way or lose
 * data, before anything is written. Run it against the target database:
 *
 *   npx tsx scripts/preflight.ts
 */
import "dotenv/config";
import { Client } from "pg";

const client = new Client({ connectionString: process.env.DATABASE_URL });

async function rows(sql: string): Promise<Record<string, unknown>[]> {
  const result = await client.query(sql);
  return result.rows;
}

async function main() {
  await client.connect();
  const target = new URL(process.env.DATABASE_URL ?? "");
  console.log(`database: ${target.hostname}${target.pathname}\n`);

  const applied = await rows(
    `SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL ORDER BY finished_at`,
  );
  console.log("applied migrations:");
  for (const row of applied) console.log(`  - ${row.migration_name}`);

  const [legacyColumn] = await rows(
    `SELECT count(*)::int AS n FROM information_schema.columns
      WHERE table_name = 'ActionItem' AND column_name = 'assigneeId'`,
  );
  const hasLegacyColumn = Number(legacyColumn.n) > 0;
  console.log(`\nActionItem.assigneeId still present: ${hasLegacyColumn}`);

  // The whole point of the exercise: assignments that exist only in the column
  // about to be dropped, with no matching row in the new join table.
  if (hasLegacyColumn) {
    const [orphaned] = await rows(
      `SELECT count(*)::int AS n
         FROM "ActionItem" a
        WHERE a."assigneeId" IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM "ActionItemAssignee" aa
             WHERE aa."actionItemId" = a.id AND aa."userId" = a."assigneeId"
          )`,
    );
    console.log(`assignments that would be LOST by the drop: ${orphaned.n}`);
  }

  console.log("\nrow counts:");
  const [counts] = await rows(
    `SELECT
       (SELECT count(*)::int FROM "User")               AS users,
       (SELECT count(*)::int FROM "Company")            AS companies,
       (SELECT count(*)::int FROM "Project")            AS projects,
       (SELECT count(*)::int FROM "Retrospective")      AS retros,
       (SELECT count(*)::int FROM "RetroColumn")        AS columns,
       (SELECT count(*)::int FROM "RetroCard")          AS cards,
       (SELECT count(*)::int FROM "CardVote")           AS votes,
       (SELECT count(*)::int FROM "Comment")            AS comments,
       (SELECT count(*)::int FROM "Reaction")           AS reactions,
       (SELECT count(*)::int FROM "ActionItem")         AS action_items,
       (SELECT count(*)::int FROM "ActionItemAssignee") AS action_assignees`,
  );
  for (const [key, value] of Object.entries(counts)) console.log(`  ${key}: ${value}`);

  // Orphans would fail the SET NOT NULL and the composite foreign key.
  console.log("\norphan checks (both must be 0):");
  const [orphanCards] = await rows(
    `SELECT count(*)::int AS n FROM "RetroCard" c
       LEFT JOIN "RetroColumn" col ON col.id = c."columnId" WHERE col.id IS NULL`,
  );
  const [orphanVotes] = await rows(
    `SELECT count(*)::int AS n FROM "CardVote" v
       LEFT JOIN "RetroCard" c ON c.id = v."cardId" WHERE c.id IS NULL`,
  );
  console.log(`  cards with no column: ${orphanCards.n}`);
  console.log(`  votes with no card:   ${orphanVotes.n}`);

  const blocked = Number(orphanCards.n) > 0 || Number(orphanVotes.n) > 0;
  console.log(`\n${blocked ? "BLOCKED — resolve the orphans first" : "OK to migrate"}`);

  await client.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
