/**
 * The one place the test database URL is defined, imported by both
 * `vitest.config.ts` and `tests/globalSetup.ts` so the config and the migration
 * step can never disagree about which database they mean.
 *
 * Defaults to the disposable container in `docker-compose.test.yml`. CI
 * overrides it with TEST_DATABASE_URL pointing at its own service.
 */
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgres://retro:retro@127.0.0.1:5433/agile_retro_test";

/**
 * The suite truncates tables between every test case. `.env` holds the real
 * database, `prisma.config.ts` loads it via dotenv, and dotenv does not
 * override an already-set variable — so a missing DATABASE_URL here would
 * silently fall through to production and delete it. Refuse to run unless the
 * URL is unmistakably a throwaway.
 */
export function assertIsDisposableTestDatabase(url: string | undefined): asserts url is string {
  if (!url) {
    throw new Error("DATABASE_URL is not set for the test run — refusing to continue.");
  }

  const { hostname, pathname } = new URL(url);
  const isLocalHost = hostname === "127.0.0.1" || hostname === "localhost" || hostname === "postgres";
  const isTestDatabase = pathname.replace(/^\//, "").endsWith("_test");

  if (!isLocalHost || !isTestDatabase) {
    throw new Error(
      `Refusing to run tests against "${hostname}${pathname}". The suite TRUNCATEs tables, so it ` +
        "only runs against a local database whose name ends in `_test`. Start the throwaway one with " +
        "`docker compose -f docker-compose.test.yml up -d`.",
    );
  }
}
