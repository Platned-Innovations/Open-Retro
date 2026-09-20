import { beforeEach, describe, expect, it } from "vitest";
import { run } from "@/server/actions/result";
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} from "@/lib/authz";
import { setRetroStatus } from "@/server/actions/retros";
import { asUser, seedFixture, type Fixture } from "./factory";

let f: Fixture;
beforeEach(async () => {
  f = await seedFixture();
});

/**
 * The mapping is the one thing the rest of the suite doesn't exercise: the
 * authorization tests call the domain functions directly, because that is where
 * the rules live. This covers the boundary that sits in front of them.
 */
describe("run", () => {
  it("wraps a success", async () => {
    await expect(run(async () => 42)).resolves.toEqual({ ok: true, data: 42 });
  });

  it("passes through the message of every refusal we author", async () => {
    const cases = [
      new UnauthorizedError("not signed in"),
      new ForbiddenError("only an admin can do that"),
      new NotFoundError("no such card"),
      new BadRequestError("a card can't be empty"),
    ];

    for (const error of cases) {
      await expect(
        run(async () => {
          throw error;
        }),
      ).resolves.toEqual({ ok: false, error: error.message });
    }
  });

  /**
   * An unexpected error must not reach the browser: its message could contain
   * anything, up to and including a connection string.
   */
  it("replaces an unexpected error with a generic message", async () => {
    const result = await run(async () => {
      throw new Error("postgres://user:hunter2@db.internal:5432/app");
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("Something went wrong. Please try again.");
      expect(result.error).not.toContain("hunter2");
    }
  });
});

describe("the action boundary", () => {
  it("returns a readable refusal instead of throwing", async () => {
    asUser(f.users.projA1Member);

    // The same call that the domain function rejects outright.
    const result = await setRetroStatus(f.retroA.id, "COMPLETED");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/facilitator or a project admin/i);
    }
  });

  it("returns the data on success", async () => {
    asUser(f.users.projA1Admin);
    const result = await setRetroStatus(f.retroA.id, "COMPLETED");

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.status).toBe("COMPLETED");
  });
});
