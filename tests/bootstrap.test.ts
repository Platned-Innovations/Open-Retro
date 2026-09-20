import { afterEach, beforeEach, describe, expect, it } from "vitest";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { pendingMigrations, seedFirstSuperAdmin } from "@/server/bootstrap";

const ENV_KEYS = ["SUPER_ADMIN_EMAIL", "SUPER_ADMIN_PASSWORD", "SUPER_ADMIN_NAME"] as const;
const original: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> = {};

beforeEach(() => {
  for (const key of ENV_KEYS) original[key] = process.env[key];
  process.env.SUPER_ADMIN_EMAIL = "Founder@Example.Test";
  process.env.SUPER_ADMIN_PASSWORD = "correct horse battery staple";
  process.env.SUPER_ADMIN_NAME = "Founder";
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (original[key] === undefined) delete process.env[key];
    else process.env[key] = original[key];
  }
});

describe("pending migrations", () => {
  /**
   * The test database is migrated by globalSetup, so "nothing pending" is the
   * expected answer — and it is the answer that matters, because it is the one
   * that lets a restart skip spawning the Prisma CLI entirely.
   */
  it("reports none against an already-migrated database", async () => {
    expect(await pendingMigrations()).toEqual([]);
  });

  it("treats a database with no migration table as needing everything", async () => {
    await prisma.$executeRawUnsafe('ALTER TABLE "_prisma_migrations" RENAME TO "_migrations_hidden"');
    try {
      const pending = await pendingMigrations();
      expect(pending.length).toBeGreaterThan(0);
      expect(pending[0]).toMatch(/^\d{14}_/);
      // Sorted, so they would be applied oldest-first.
      expect([...pending].sort()).toEqual(pending);
    } finally {
      await prisma.$executeRawUnsafe('ALTER TABLE "_migrations_hidden" RENAME TO "_prisma_migrations"');
    }
  });

  it("names a committed migration the database has not applied", async () => {
    const [victim] = await prisma.$queryRaw<{ migration_name: string }[]>`
      SELECT migration_name FROM "_prisma_migrations" ORDER BY migration_name DESC LIMIT 1
    `;
    await prisma.$executeRaw`
      UPDATE "_prisma_migrations" SET finished_at = NULL WHERE migration_name = ${victim.migration_name}
    `;
    try {
      expect(await pendingMigrations()).toEqual([victim.migration_name]);
    } finally {
      await prisma.$executeRaw`
        UPDATE "_prisma_migrations" SET finished_at = now() WHERE migration_name = ${victim.migration_name}
      `;
    }
  });
});

describe("seeding the first super admin", () => {
  it("creates one on an empty database", async () => {
    const result = await seedFirstSuperAdmin();

    expect(result).toEqual({ created: true, email: "founder@example.test" });
    const user = await prisma.user.findUniqueOrThrow({ where: { email: "founder@example.test" } });
    expect(user.role).toBe("SUPER_ADMIN");
    expect(user.name).toBe("Founder");
    expect(await bcrypt.compare("correct horse battery staple", user.passwordHash!)).toBe(true);
  });

  /**
   * The behaviour that makes this safe to run on every restart. `prisma/seed.ts`
   * upserts and would reset the password; doing that automatically would
   * silently undo a password change on the next deploy.
   */
  it("never touches an existing user, even the one it would have created", async () => {
    await seedFirstSuperAdmin();
    const before = await prisma.user.findUniqueOrThrow({ where: { email: "founder@example.test" } });

    await prisma.user.update({
      where: { email: "founder@example.test" },
      data: { passwordHash: await bcrypt.hash("they changed it", 12), name: "Renamed" },
    });

    const second = await seedFirstSuperAdmin();
    expect(second).toEqual({ created: false, reason: "the database already has users" });

    const after = await prisma.user.findUniqueOrThrow({ where: { email: "founder@example.test" } });
    expect(after.id).toBe(before.id);
    expect(after.name).toBe("Renamed");
    expect(await bcrypt.compare("they changed it", after.passwordHash!)).toBe(true);
  });

  /**
   * "No users at all" rather than "no Super Admin": a database whose admins
   * were deliberately demoted must not have a new one conjured from
   * environment variables on the next restart.
   */
  it("stays out of the way when users exist but none is a super admin", async () => {
    await prisma.user.create({ data: { email: "someone@example.test", name: "Someone" } });

    const result = await seedFirstSuperAdmin();
    expect(result).toEqual({ created: false, reason: "the database already has users" });
    expect(await prisma.user.count({ where: { role: "SUPER_ADMIN" } })).toBe(0);
  });

  it("explains itself rather than failing when the credentials are absent", async () => {
    delete process.env.SUPER_ADMIN_EMAIL;
    delete process.env.SUPER_ADMIN_PASSWORD;

    const result = await seedFirstSuperAdmin();
    expect(result.created).toBe(false);
    expect(result.created === false && result.reason).toContain("SUPER_ADMIN_EMAIL");
    expect(await prisma.user.count()).toBe(0);
  });

  it("falls back to a sensible name", async () => {
    delete process.env.SUPER_ADMIN_NAME;
    await seedFirstSuperAdmin();

    const user = await prisma.user.findUniqueOrThrow({ where: { email: "founder@example.test" } });
    expect(user.name).toBe("Super Admin");
  });
});
