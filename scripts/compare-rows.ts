/**
 * Compares every field that existed *before* a migration against a backup.
 *
 * The count checks in verify-migration.ts prove nothing was added or deleted;
 * this proves nothing was quietly rewritten. New columns are excluded by
 * listing the old ones explicitly rather than diffing whole rows.
 *
 *   npx tsx scripts/compare-rows.ts <backup-file>
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { Client } from "pg";

/** table -> the fields that existed before the phase-engine migration. */
const PRE_EXISTING_FIELDS: Record<string, string[]> = {
  User: ["id", "email", "name", "role", "passwordHash", "image"],
  Company: ["id", "name", "createdById"],
  Project: ["id", "companyId", "name", "description", "createdById"],
  Retrospective: [
    "id",
    "projectId",
    "title",
    "template",
    "status",
    "isAnonymous",
    "timerSeconds",
    "facilitatorId",
    "createdById",
  ],
  RetroColumn: ["id", "retrospectiveId", "title", "color", "order"],
  RetroCard: ["id", "columnId", "authorId", "content", "order", "groupId"],
  CardVote: ["id", "cardId", "userId"],
  // "done" is deliberately absent: the action-item migration dropped it, and
  // verify-action-items.ts checks how it was mapped onto "status" instead.
  ActionItem: ["id", "retrospectiveId", "description", "createdById"],
  ActionItemAssignee: ["id", "actionItemId", "userId"],
  Comment: ["id", "cardId", "actionItemId", "authorId", "content"],
  Reaction: ["id", "cardId", "userId", "emoji"],
  CompanyMembership: ["id", "userId", "companyId", "role"],
  ProjectMembership: ["id", "userId", "projectId", "role"],
};

function fingerprint(row: Record<string, unknown>, fields: string[]): string {
  return JSON.stringify(
    fields.map((field) => {
      const value = row[field];
      return value === null || value === undefined ? null : String(value);
    }),
  );
}

async function main() {
  const backupPath = process.argv[2];
  if (!backupPath) throw new Error("Usage: tsx scripts/compare-rows.ts <backup-file>");

  const backup = JSON.parse(readFileSync(backupPath, "utf8")) as {
    tables: Record<string, Record<string, unknown>[]>;
  };

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  let differing = 0;
  for (const [table, fields] of Object.entries(PRE_EXISTING_FIELDS)) {
    const before = backup.tables[table] ?? [];
    const now = (await client.query(`SELECT * FROM "${table}" ORDER BY id`)).rows;

    const sortedBefore = [...before].sort((a, b) => String(a.id).localeCompare(String(b.id)));
    const sortedNow = [...now].sort((a, b) => String(a.id).localeCompare(String(b.id)));

    const same =
      sortedBefore.length === sortedNow.length &&
      sortedBefore.every((row, i) => fingerprint(row, fields) === fingerprint(sortedNow[i], fields));

    if (!same) differing += 1;
    console.log(
      `  ${same ? "identical" : "DIFFERS  "}  ${table} — ${now.length} rows × ${fields.length} pre-existing fields`,
    );
  }

  console.log(
    `\n${differing === 0 ? "PASS — every pre-existing field holds the value it held before" : `FAILED (${differing} tables differ)`}`,
  );
  await client.end();
  if (differing > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
