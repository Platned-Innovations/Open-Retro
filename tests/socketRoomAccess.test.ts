import { beforeEach, describe, expect, it } from "vitest";
import { requireRetroAccess } from "@/lib/authz";
import { canJoinRetroRoom } from "@/lib/socket/roomAccess";
import { asUser, seedFixture, type Fixture } from "./factory";

let f: Fixture;
beforeEach(async () => {
  f = await seedFixture();
});

describe("canJoinRetroRoom", () => {
  it("admits a project member", async () => {
    await expect(canJoinRetroRoom(f.users.projA1Member.id, f.retroA.id)).resolves.toBe(true);
  });

  it("admits a company admin who is on no project", async () => {
    await expect(canJoinRetroRoom(f.users.coAAdmin.id, f.retroA.id)).resolves.toBe(true);
  });

  it("admits a super admin", async () => {
    await expect(canJoinRetroRoom(f.users.superAdmin.id, f.retroA.id)).resolves.toBe(true);
  });

  it("refuses someone from another company", async () => {
    await expect(canJoinRetroRoom(f.users.outsiderB.id, f.retroA.id)).resolves.toBe(false);
  });

  it("refuses a user with no memberships", async () => {
    await expect(canJoinRetroRoom(f.users.stranger.id, f.retroA.id)).resolves.toBe(false);
  });

  it("refuses an unknown retro id", async () => {
    await expect(canJoinRetroRoom(f.users.projA1Member.id, "nope")).resolves.toBe(false);
  });
});

/**
 * The socket check is a deliberate copy of `requireProjectMember`'s rule,
 * because the custom server must not import `@/lib/authz` (server-only, and it
 * drags NextAuth and next/headers in with it). Duplicated logic drifts, so this
 * runs the same user matrix through both and asserts they agree.
 */
describe("the socket rule agrees with the HTTP rule", () => {
  it("matches requireRetroAccess for every kind of user", async () => {
    const matrix = [
      f.users.superAdmin,
      f.users.coAAdmin,
      f.users.projA1Admin,
      f.users.projA1Member,
      f.users.projA2Member,
      f.users.outsiderB,
      f.users.stranger,
    ];

    for (const user of matrix) {
      asUser(user);
      const httpAllows = await requireRetroAccess(f.retroA.id).then(
        () => true,
        () => false,
      );
      const socketAllows = await canJoinRetroRoom(user.id, f.retroA.id);

      expect(socketAllows, `disagreement for ${user.name}`).toBe(httpAllows);
    }
  });
});
