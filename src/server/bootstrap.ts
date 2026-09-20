/**
 * Bringing a database up to date before the server serves anything.
 *
 * Point this app at an empty Postgres, start it, and it creates every table,
 * index and constraint and then provisions the first Super Admin. That is the
 * whole reason this exists: a self-hoster should be able to set DATABASE_URL
 * and run, without first learning what Prisma is.
 *
 * Deliberately free of `server-only`, like src/lib/socket/roomAccess.ts:
 * `server.ts` runs under plain `tsx`, where importing that package throws. Only
 * `@/lib/prisma`, which is clean, is pulled in here.
 */

import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

const MIGRATIONS_DIR = path.join(process.cwd(), "prisma", "migrations");

/** Migration directory names, which are exactly the ids Prisma records. */
function committedMigrations(): string[] {
  return readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

/**
 * Which committed migrations this database has not applied.
 *
 * Asked directly rather than by shelling out to `prisma migrate status`,
 * because this runs on *every* start — including every `tsx watch` restart
 * while someone is editing a file. One indexed query costs milliseconds;
 * spawning the Prisma CLI costs a second or two, every save.
 *
 * A missing `_prisma_migrations` table means a database that has never been
 * migrated at all, which is the empty-database case this is here for.
 */
export async function pendingMigrations(): Promise<string[]> {
  const committed = committedMigrations();

  // Asked, not discovered by failing. Selecting from a missing table would
  // work — the throw is catchable — but Prisma logs a red "Invalid
  // prisma.$queryRaw() invocation" to the console on its way out, and the very
  // first thing someone setting this up should see is not an error they are
  // meant to ignore. `to_regclass` returns NULL instead of raising.
  const [{ exists }] = await prisma.$queryRaw<{ exists: boolean }[]>`
    SELECT to_regclass('public._prisma_migrations') IS NOT NULL AS exists
  `;
  if (!exists) return committed;

  const rows = await prisma.$queryRaw<{ migration_name: string }[]>`
    SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL
  `;
  const applied = new Set(rows.map((row) => row.migration_name));
  return committed.filter((name) => !applied.has(name));
}

/**
 * Applies pending migrations by invoking Prisma's own CLI.
 *
 * `migrate deploy`, never `migrate dev`: it applies committed migrations only,
 * never writes a new one, and never needs a shadow database — which this
 * project's database user has historically had no rights to create. It is also
 * idempotent, so the worst a redundant run costs is time.
 *
 * Shelling out rather than calling a library: Prisma exposes no supported
 * programmatic migrate API, and quietly reimplementing its advisory locking
 * and checksum verification would be far worse than spawning the real thing.
 */
function applyMigrations(): void {
  execFileSync("npx", ["prisma", "migrate", "deploy"], {
    stdio: "inherit",
    // npx is a .cmd shim on Windows, which execFile cannot invoke directly.
    shell: true,
  });
}

/**
 * Creates the first Super Admin, and only the first.
 *
 * Runs **only against a completely empty User table**. That is a deliberately
 * narrower rule than `prisma/seed.ts`, which upserts and therefore resets the
 * password every time it is invoked — correct for a command someone types on
 * purpose to re-provision an admin, and quite wrong for something that runs on
 * every restart, where it would silently undo a password change.
 *
 * "No users at all" is also unambiguous in a way "no Super Admin" is not: a
 * database whose admins were all demoted deliberately should not have a new one
 * conjured from environment variables on the next restart.
 */
export async function seedFirstSuperAdmin(): Promise<
  { created: true; email: string } | { created: false; reason: string }
> {
  if ((await prisma.user.count()) > 0) {
    return { created: false, reason: "the database already has users" };
  }

  const email = process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SUPER_ADMIN_PASSWORD;
  const name = process.env.SUPER_ADMIN_NAME?.trim() || "Super Admin";

  if (!email || !password) {
    return {
      created: false,
      reason:
        "SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD are not set, so there is nobody to create. " +
        "Set them and restart, or run `npm run db:seed`",
    };
  }

  await prisma.user.create({
    data: { email, name, role: "SUPER_ADMIN", passwordHash: await bcrypt.hash(password, 12) },
  });
  return { created: true, email };
}

/** Says what is wrong in terms someone setting this up for the first time can act on. */
function explainFailure(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const host = (() => {
    try {
      return new URL(process.env.DATABASE_URL ?? "").host;
    } catch {
      return "(unparseable DATABASE_URL)";
    }
  })();

  if (/ECONNREFUSED|ENOTFOUND|EAI_AGAIN|timeout/i.test(message)) {
    return `Could not reach the database at ${host}. Check DATABASE_URL, that the server is running, and that its firewall allows this host.`;
  }
  if (/password authentication|role .* does not exist|permission denied/i.test(message)) {
    return `The database at ${host} refused these credentials. Check the user and password in DATABASE_URL.`;
  }
  return message;
}

/**
 * Migrate, then seed, before the server accepts a request.
 *
 * Failure exits the process rather than starting anyway. An app serving
 * requests against a half-migrated schema fails in a hundred confusing ways;
 * one that refuses to start says exactly what is wrong, once. On a hosted
 * platform the restart is the retry.
 */
export async function bootstrapDatabase(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    console.error("\n✖ DATABASE_URL is not set. Copy .env.example to .env and fill it in.\n");
    process.exit(1);
  }

  if (process.env.AUTO_MIGRATE === "false") {
    console.log("[bootstrap] AUTO_MIGRATE=false — skipping migration and seeding");
    return;
  }

  try {
    const pending = await pendingMigrations();

    if (pending.length === 0) {
      console.log("[bootstrap] database is up to date");
    } else {
      console.log(
        `[bootstrap] applying ${pending.length} migration${pending.length === 1 ? "" : "s"}: ${pending.join(", ")}`,
      );
      applyMigrations();
    }

    const seeded = await seedFirstSuperAdmin();
    console.log(
      seeded.created
        ? `[bootstrap] created the first Super Admin: ${seeded.email}`
        : `[bootstrap] not seeding — ${seeded.reason}`,
    );
  } catch (error) {
    console.error(`\n✖ Database setup failed.\n\n  ${explainFailure(error)}\n`);
    console.error("Set AUTO_MIGRATE=false to start the server without it.\n");
    process.exit(1);
  }
}
