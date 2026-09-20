/**
 * Runs one read-only SQL statement against DATABASE_URL and prints the rows.
 *
 * For the ad-hoc "what does this actually look like right now" questions that
 * come up around a migration. Refuses anything that isn't a SELECT, so it can't
 * become a way to change data by accident.
 *
 *   npx tsx scripts/query.ts "SELECT count(*) FROM \"User\""
 */
import "dotenv/config";
import { Client } from "pg";

async function main() {
  const sql = process.argv[2];
  if (!sql) throw new Error('Usage: tsx scripts/query.ts "<select statement>"');
  if (!/^\s*select\b/i.test(sql)) throw new Error("Only SELECT statements are allowed here.");

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const result = await client.query(sql);
  console.table(result.rows);
  await client.end();
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exit(1);
});
