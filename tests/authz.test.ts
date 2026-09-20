import { beforeEach, describe, expect, it } from "vitest";
import {
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  requireProjectMember,
  requireRetroAccess,
  requireUser,
} from "@/lib/authz";
import { asSignedOut, asUser, seedFixture, type Fixture } from "./factory";

let f: Fixture;
beforeEach(async () => {
  f = await seedFixture();
});

describe("requireUser", () => {
  it("rejects a signed-out caller", async () => {
    asSignedOut();
    await expect(requireUser()).rejects.toThrow(UnauthorizedError);
  });
});

describe("requireProjectMember", () => {
  it("admits a direct project member", async () => {
    asUser(f.users.projA1Member);
    await expect(requireProjectMember(f.projectA1.id)).resolves.toMatchObject({
      id: f.users.projA1Member.id,
    });
  });

  // The documented rule from authz.ts: a company admin manages the whole
  // company, so browsing a project inside it shouldn't 403 just because nobody
  // added them to that specific project. coAAdmin is on no project at all.
  it("admits a company admin to a project they are not a member of", async () => {
    asUser(f.users.coAAdmin);
    await expect(requireProjectMember(f.projectA2.id)).resolves.toMatchObject({
      id: f.users.coAAdmin.id,
    });
  });

  it("admits a super admin to any project", async () => {
    asUser(f.users.superAdmin);
    await expect(requireProjectMember(f.projectB1.id)).resolves.toBeTruthy();
  });

  it("rejects someone from another company", async () => {
    asUser(f.users.outsiderB);
    await expect(requireProjectMember(f.projectA1.id)).rejects.toThrow(ForbiddenError);
  });

  it("rejects a user with no memberships at all", async () => {
    asUser(f.users.stranger);
    await expect(requireProjectMember(f.projectA1.id)).rejects.toThrow(ForbiddenError);
  });

  describe("adminOnly", () => {
    it("rejects a plain member", async () => {
      asUser(f.users.projA1Member);
      await expect(requireProjectMember(f.projectA1.id, { adminOnly: true })).rejects.toThrow(
        ForbiddenError,
      );
    });

    it("admits a project admin", async () => {
      asUser(f.users.projA1Admin);
      await expect(
        requireProjectMember(f.projectA1.id, { adminOnly: true }),
      ).resolves.toBeTruthy();
    });
  });
});

describe("requireRetroAccess", () => {
  it("admits a member of the owning project, and returns the retro's context", async () => {
    asUser(f.users.projA1Member);
    await expect(requireRetroAccess(f.retroA.id)).resolves.toMatchObject({
      user: { id: f.users.projA1Member.id },
      retro: {
        id: f.retroA.id,
        projectId: f.projectA1.id,
        companyId: f.companyA.id,
        facilitatorId: f.users.projA1Admin.id,
        status: "ACTIVE",
      },
    });
  });

  it("rejects a member of another company's project", async () => {
    asUser(f.users.outsiderB);
    await expect(requireRetroAccess(f.retroA.id)).rejects.toThrow(ForbiddenError);
  });

  // The distinction matters: pages call notFound() on NotFoundError but let
  // ForbiddenError reach the error boundary, so collapsing the two would turn
  // "you can't see this" into a 404 (or vice versa).
  it("throws NotFoundError, not ForbiddenError, for an unknown retro", async () => {
    asUser(f.users.projA1Member);
    await expect(requireRetroAccess("does-not-exist")).rejects.toThrow(NotFoundError);
  });
});
