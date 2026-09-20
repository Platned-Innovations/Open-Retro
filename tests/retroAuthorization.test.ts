import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/email/graphMailer";
import { setRetroStatus, startTimer, stopTimer } from "@/server/retro/lifecycle";
import { addComment, createCard, deleteCard, groupCards, moveCard, toggleReaction, toggleVote, updateCard } from "@/server/retro/cards";
import { createActionItem, deleteActionItem, updateActionItem, updateActionItemAssignees } from "@/server/retro/actionItems";
import { asUser, seedCard as seedFactoryCard, seedFixture, type Fixture } from "./factory";

let f: Fixture;
beforeEach(async () => {
  f = await seedFixture();
});

/** A card in the given retro's first column. */
function seedCard(retro: Fixture["retroA"], authorId: string, content = "a card") {
  return seedFactoryCard(retro, { authorId, content });
}

async function seedActionItem(retrospectiveId: string, createdById: string) {
  return prisma.actionItem.create({
    data: { retrospectiveId, description: "an action", createdById },
  });
}

/**
 * The whole class of bug in one sentence: every one of these actions authorizes
 * the `retrospectiveId` argument and then mutates a *different*, unchecked id.
 * So a legitimate member of retro A passes retro A's id as the ticket, and
 * another company's card id as the target.
 */
describe("cross-retro object access (IDOR)", () => {
  it("refuses to create a card in another retro's column", async () => {
    asUser(f.users.projA1Member);
    await expect(
      createCard({
        retrospectiveId: f.retroA.id,
        columnId: f.retroB.columns[0].id,
        content: "injected",
      }),
    ).rejects.toThrow();
    expect(await prisma.retroCard.count()).toBe(0);
  });

  it("refuses to edit or delete a card in another retro", async () => {
    const victim = await seedCard(f.retroB, f.users.outsiderB.id, "original");
    asUser(f.users.projA1Member);

    await expect(updateCard(f.retroA.id, victim.id, "pwned")).rejects.toThrow();
    await expect(deleteCard(f.retroA.id, victim.id)).rejects.toThrow();

    const after = await prisma.retroCard.findUnique({ where: { id: victim.id } });
    expect(after?.content).toBe("original");
  });

  it("refuses to move a card into another retro's column", async () => {
    const mine = await seedCard(f.retroA, f.users.projA1Member.id);
    asUser(f.users.projA1Member);

    await expect(
      moveCard({
        retrospectiveId: f.retroA.id,
        cardId: mine.id,
        toColumnId: f.retroB.columns[0].id,
        toIndex: 0,
      }),
    ).rejects.toThrow();

    const after = await prisma.retroCard.findUniqueOrThrow({ where: { id: mine.id } });
    expect(after.columnId).toBe(f.retroA.columns[0].id);
  });

  it("refuses to group a card onto one in another retro", async () => {
    const mine = await seedCard(f.retroA, f.users.projA1Member.id);
    const theirs = await seedCard(f.retroB, f.users.outsiderB.id);
    asUser(f.users.projA1Member);

    await expect(groupCards(f.retroA.id, mine.id, theirs.id)).rejects.toThrow();
    const after = await prisma.retroCard.findUniqueOrThrow({ where: { id: mine.id } });
    expect(after.groupId).toBeNull();
  });

  it("refuses to vote on, react to, or comment on another retro's card", async () => {
    const victim = await seedCard(f.retroB, f.users.outsiderB.id);
    asUser(f.users.projA1Member);

    await expect(toggleVote(f.retroA.id, victim.id)).rejects.toThrow();
    await expect(toggleReaction(f.retroA.id, victim.id, "👍")).rejects.toThrow();
    await expect(
      addComment({ retrospectiveId: f.retroA.id, cardId: victim.id, content: "hi" }),
    ).rejects.toThrow();

    expect(await prisma.cardVote.count()).toBe(0);
    expect(await prisma.reaction.count()).toBe(0);
    expect(await prisma.comment.count()).toBe(0);
  });

  it("refuses to touch an action item belonging to another retro", async () => {
    const victim = await seedActionItem(f.retroB.id, f.users.outsiderB.id);
    asUser(f.users.projA1Member);

    await expect(
      updateActionItem({
        retrospectiveId: f.retroA.id,
        actionItemId: victim.id,
        description: "pwned",
      }),
    ).rejects.toThrow();
    await expect(
      updateActionItemAssignees(f.retroA.id, victim.id, [f.users.projA1Member.id]),
    ).rejects.toThrow();
    await expect(deleteActionItem(f.retroA.id, victim.id)).rejects.toThrow();

    const after = await prisma.actionItem.findUnique({ where: { id: victim.id } });
    expect(after?.description).toBe("an action");
  });
});

/**
 * The email-amplification hole: assigneeIds went straight into a nested create
 * and then into a Microsoft Graph sendMail, with no membership check. That is
 * an authenticated arbitrary-recipient mailer with attacker-chosen body text.
 */
describe("action item assignees", () => {
  it("refuses to assign someone outside the project, and sends no mail", async () => {
    asUser(f.users.projA1Member);

    await expect(
      createActionItem({
        retrospectiveId: f.retroA.id,
        description: "click here http://evil.example",
        assigneeIds: [f.users.outsiderB.id],
      }),
    ).rejects.toThrow();

    expect(await prisma.actionItem.count()).toBe(0);
    expect(vi.mocked(sendMail)).not.toHaveBeenCalled();
  });

  it("refuses to add an outsider to an existing item, and sends no mail", async () => {
    const item = await seedActionItem(f.retroA.id, f.users.projA1Member.id);
    asUser(f.users.projA1Member);

    await expect(
      updateActionItemAssignees(f.retroA.id, item.id, [f.users.outsiderB.id]),
    ).rejects.toThrow();

    expect(await prisma.actionItemAssignee.count()).toBe(0);
    expect(vi.mocked(sendMail)).not.toHaveBeenCalled();
  });

  it("still allows assigning a genuine project member", async () => {
    asUser(f.users.projA1Member);
    const item = await createActionItem({
      retrospectiveId: f.retroA.id,
      description: "real work",
      assigneeIds: [f.users.projA1Other.id],
    });
    expect(item.assignees).toHaveLength(1);
  });
});

/**
 * These were gated in the UI only, so the server happily accepted them from
 * anyone who could reach the action at all.
 */
describe("moderator-only controls", () => {
  it("refuses to let a plain member close the retro", async () => {
    asUser(f.users.projA1Member);
    await expect(setRetroStatus(f.retroA.id, "COMPLETED")).rejects.toThrow();

    const after = await prisma.retrospective.findUniqueOrThrow({ where: { id: f.retroA.id } });
    expect(after.status).toBe("ACTIVE");
  });

  it("refuses to let a plain member start or stop the timer", async () => {
    asUser(f.users.projA1Member);
    await expect(startTimer(f.retroA.id, 300)).rejects.toThrow();
    await expect(stopTimer(f.retroA.id)).rejects.toThrow();
  });

  it("allows the facilitator and a company admin to do both", async () => {
    asUser(f.users.projA1Admin); // also retroA's facilitator
    await expect(startTimer(f.retroA.id, 300)).resolves.toBeTruthy();
    await expect(setRetroStatus(f.retroA.id, "COMPLETED")).resolves.toBeTruthy();

    asUser(f.users.coAAdmin); // company admin, on no project
    await expect(setRetroStatus(f.retroA.id, "ACTIVE")).resolves.toBeTruthy();
  });
});

describe("card ownership", () => {
  it("refuses to let one member edit or delete another member's card", async () => {
    const theirs = await seedCard(f.retroA, f.users.projA1Other.id, "their words");
    asUser(f.users.projA1Member);

    await expect(updateCard(f.retroA.id, theirs.id, "rewritten")).rejects.toThrow();
    await expect(deleteCard(f.retroA.id, theirs.id)).rejects.toThrow();

    const after = await prisma.retroCard.findUniqueOrThrow({ where: { id: theirs.id } });
    expect(after.content).toBe("their words");
  });

  it("allows the author to edit their own card", async () => {
    const mine = await seedCard(f.retroA, f.users.projA1Member.id, "mine");
    asUser(f.users.projA1Member);
    await expect(updateCard(f.retroA.id, mine.id, "edited")).resolves.toBeTruthy();
  });

  it("allows a moderator to edit anyone's card", async () => {
    const theirs = await seedCard(f.retroA, f.users.projA1Other.id, "their words");
    asUser(f.users.projA1Admin);
    await expect(updateCard(f.retroA.id, theirs.id, "moderated")).resolves.toBeTruthy();
  });
});
