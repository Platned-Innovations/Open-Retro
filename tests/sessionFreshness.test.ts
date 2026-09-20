import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { UnauthorizedError, requireSuperAdmin, requireUser } from "@/lib/authz";
import { rateLimit, resetRateLimits } from "@/lib/rateLimit";
import { asUser, seedFixture, type Fixture } from "./factory";

let f: Fixture;
beforeEach(async () => {
  f = await seedFixture();
  resetRateLimits();
});

/**
 * `asUser` mints a session exactly as sign-in would: role and name frozen at
 * the moment of authentication. These tests change the database underneath that
 * session, which is what a demotion or a rename actually does.
 */
describe("session freshness", () => {
  it("honours a demotion immediately, without waiting for the token to expire", async () => {
    asUser(f.users.superAdmin);
    await expect(requireSuperAdmin()).resolves.toBeTruthy();

    await prisma.user.update({ where: { id: f.users.superAdmin.id }, data: { role: "USER" } });

    // The session cookie still claims SUPER_ADMIN. The database does not.
    await expect(requireSuperAdmin()).rejects.toThrow();
    await expect(requireUser()).resolves.toMatchObject({ role: "USER" });
  });

  it("reflects a rename immediately", async () => {
    asUser(f.users.projA1Member);
    await prisma.user.update({
      where: { id: f.users.projA1Member.id },
      data: { name: "Renamed Person" },
    });

    await expect(requireUser()).resolves.toMatchObject({ name: "Renamed Person" });
  });

  it("rejects a session whose account has been deleted", async () => {
    asUser(f.users.projA1Member);
    await prisma.user.delete({ where: { id: f.users.projA1Member.id } });

    await expect(requireUser()).rejects.toThrow(UnauthorizedError);
  });
});

describe("rateLimit", () => {
  it("allows up to the limit and then refuses", () => {
    const opts = { limit: 3, windowMs: 60_000 };
    expect(rateLimit("k", opts).ok).toBe(true);
    expect(rateLimit("k", opts).ok).toBe(true);
    expect(rateLimit("k", opts).ok).toBe(true);

    const refused = rateLimit("k", opts);
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.retryAfterMs).toBeGreaterThan(0);
  });

  it("counts each key separately", () => {
    const opts = { limit: 1, windowMs: 60_000 };
    expect(rateLimit("a", opts).ok).toBe(true);
    expect(rateLimit("b", opts).ok).toBe(true);
    expect(rateLimit("a", opts).ok).toBe(false);
  });

  it("starts a fresh window once the old one has passed", async () => {
    const opts = { limit: 1, windowMs: 20 };
    expect(rateLimit("short", opts).ok).toBe(true);
    expect(rateLimit("short", opts).ok).toBe(false);

    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(rateLimit("short", opts).ok).toBe(true);
  });
});
