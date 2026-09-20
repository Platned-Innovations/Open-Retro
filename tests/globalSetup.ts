import { execFileSync } from "node:child_process";
import { TEST_DATABASE_URL, assertIsDisposableTestDatabase } from "./testDatabaseUrl";

/**
 * Brings the test database up to the committed migration history once per run.
 *
 * `migrate deploy` (not `migrate dev`) deliberately: it applies the committed
 * migrations and never needs a shadow database, which this project's database
 * user has historically not had rights to create.
 */
export default function setup() {
  assertIsDisposableTestDatabase(TEST_DATABASE_URL);

  execFileSync("npx", ["prisma", "migrate", "deploy"], {
    // Passing DATABASE_URL explicitly means prisma.config.ts's dotenv load
    // finds it already set and leaves it alone, so `.env` can't win here.
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    stdio: "inherit",
    // npx is a .cmd shim on Windows, which execFile can't invoke directly.
    shell: true,
  });
}
