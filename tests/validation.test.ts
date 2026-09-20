import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/email/graphMailer";
import { BadRequestError } from "@/lib/authz";
import { createRetrospective, startTimer } from "@/server/retro/lifecycle";
import { createCard, toggleReaction } from "@/server/retro/cards";
import { inviteUserToProject } from "@/server/org/invitations";
import { asUser, seedCard, seedFixture, type Fixture } from "./factory";

let f: Fixture;
beforeEach(async () => {
  f = await seedFixture();
});

describe("retro input bounds", () => {
  it("caps the number of custom columns", async () => {
    const columnsBefore = await prisma.retroColumn.count();
    asUser(f.users.projA1Member);

    await expect(
      createRetrospective({
        projectId: f.projectA1.id,
        title: "Too wide",
        template: "CUSTOM",
        customColumns: Array.from({ length: 500 }, (_, i) => `col ${i}`),
      }),
    ).rejects.toThrow(BadRequestError);

    // Rejected at the boundary, so neither the retro nor its 500 column rows
    // reached the transaction.
    expect(await prisma.retrospective.count()).toBe(3);
    expect(await prisma.retroColumn.count()).toBe(columnsBefore);
  });

  it("rejects a CUSTOM retro with no columns", async () => {
    asUser(f.users.projA1Member);
    await expect(
      createRetrospective({
        projectId: f.projectA1.id,
        title: "Empty",
        template: "CUSTOM",
        customColumns: [],
      }),
    ).rejects.toThrow(BadRequestError);
  });

  it("rejects an empty card", async () => {
    asUser(f.users.projA1Member);
    await expect(
      createCard({
        retrospectiveId: f.retroA.id,
        columnId: f.retroA.columns[0].id,
        content: "   ",
      }),
    ).rejects.toThrow(BadRequestError);
    expect(await prisma.retroCard.count()).toBe(0);
  });

  it("rejects an oversized card body", async () => {
    asUser(f.users.projA1Member);
    await expect(
      createCard({
        retrospectiveId: f.retroA.id,
        columnId: f.retroA.columns[0].id,
        content: "x".repeat(5000),
      }),
    ).rejects.toThrow(BadRequestError);
    expect(await prisma.retroCard.count()).toBe(0);
  });

  // `new Date(Date.now() + 1e15 * 1000)` is an Invalid Date, which the
  // countdown then rendered indefinitely.
  it("rejects an absurd timer duration", async () => {
    asUser(f.users.projA1Admin);
    await expect(startTimer(f.retroA.id, 1e15)).rejects.toThrow(BadRequestError);
  });

  it("rejects an emoji outside the allowed set", async () => {
    const card = await seedCard(f.retroA, {
      authorId: f.users.projA1Member.id,
      content: "a card",
    });
    asUser(f.users.projA1Member);

    await expect(toggleReaction(f.retroA.id, card.id, "<script>")).rejects.toThrow(BadRequestError);
    expect(await prisma.reaction.count()).toBe(0);

    // The real ones still work.
    await expect(toggleReaction(f.retroA.id, card.id, "👍")).resolves.toBeUndefined();
    expect(await prisma.reaction.count()).toBe(1);
  });
});

describe("invite input bounds", () => {
  /**
   * Invites auto-create a User for whatever address they are given, so a
   * missing format check meant any string became a permanent account.
   */
  it("rejects a malformed email without creating a user or sending mail", async () => {
    const before = await prisma.user.count();
    asUser(f.users.projA1Admin);

    await expect(
      inviteUserToProject({ projectId: f.projectA1.id, email: "not-an-email" }),
    ).rejects.toThrow(BadRequestError);

    expect(await prisma.user.count()).toBe(before);
    expect(vi.mocked(sendMail)).not.toHaveBeenCalled();
  });

  it("still accepts a real address, normalised", async () => {
    asUser(f.users.projA1Admin);
    const { userId } = await inviteUserToProject({
      projectId: f.projectA1.id,
      email: "  New.Person@Example.COM ",
    });

    const created = await prisma.user.findUnique({ where: { id: userId } });
    expect(created?.email).toBe("new.person@example.com");
  });
});
