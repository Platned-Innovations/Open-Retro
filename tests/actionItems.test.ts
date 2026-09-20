import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/email/graphMailer";
import { ForbiddenError, NotFoundError } from "@/lib/authz";
import { createActionItem, setActionItemStatus } from "@/server/retro/actionItems";
import {
  carryOverActionItems,
  dismissCarryOver,
  listCarryOverCandidates,
} from "@/server/retro/carryOver";
import { countMyOpenActionItems, listMyActionItems } from "@/server/queries/myActions";
import { getRetroBoard } from "@/server/queries/retros";
import { asUser, seedFixture, type Fixture } from "./factory";

let f: Fixture;
beforeEach(async () => {
  f = await seedFixture();
});

/** An action item on a retro, optionally assigned. */
async function seedActionItem(input: {
  retrospectiveId: string;
  description: string;
  createdById: string;
  assigneeIds?: string[];
  status?: "OPEN" | "IN_PROGRESS" | "BLOCKED" | "DONE" | "DROPPED";
  dueDate?: Date;
}) {
  return prisma.actionItem.create({
    data: {
      retrospectiveId: input.retrospectiveId,
      description: input.description,
      createdById: input.createdById,
      status: input.status ?? "OPEN",
      dueDate: input.dueDate,
      assignees: { create: (input.assigneeIds ?? []).map((userId) => ({ userId })) },
    },
  });
}

describe("action item status", () => {
  it("records a completion time on the way into DONE, and clears it on the way out", async () => {
    const item = await seedActionItem({
      retrospectiveId: f.retroA.id,
      description: "ship it",
      createdById: f.users.projA1Member.id,
    });
    asUser(f.users.projA1Member);

    await setActionItemStatus({
      retrospectiveId: f.retroA.id,
      actionItemId: item.id,
      status: "DONE",
    });
    const done = await prisma.actionItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(done.status).toBe("DONE");
    expect(done.completedAt).not.toBeNull();

    await setActionItemStatus({
      retrospectiveId: f.retroA.id,
      actionItemId: item.id,
      status: "IN_PROGRESS",
    });
    const reopened = await prisma.actionItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(reopened.completedAt).toBeNull();
  });

  /** Re-saving a finished item shouldn't email everyone again. */
  it("notifies only on the transition into DONE", async () => {
    const item = await seedActionItem({
      retrospectiveId: f.retroA.id,
      description: "ship it",
      createdById: f.users.projA1Member.id,
      assigneeIds: [f.users.projA1Other.id],
    });
    asUser(f.users.projA1Member);

    await setActionItemStatus({ retrospectiveId: f.retroA.id, actionItemId: item.id, status: "DONE" });
    expect(vi.mocked(sendMail)).toHaveBeenCalledTimes(1);

    await setActionItemStatus({ retrospectiveId: f.retroA.id, actionItemId: item.id, status: "DONE" });
    expect(vi.mocked(sendMail)).toHaveBeenCalledTimes(1);
  });

  it("refuses an item belonging to another retro", async () => {
    const theirs = await seedActionItem({
      retrospectiveId: f.retroB.id,
      description: "not yours",
      createdById: f.users.outsiderB.id,
    });
    asUser(f.users.projA1Member);

    await expect(
      setActionItemStatus({
        retrospectiveId: f.retroA.id,
        actionItemId: theirs.id,
        status: "DONE",
      }),
    ).rejects.toThrow(NotFoundError);
  });
});

describe("carry-over", () => {
  it("offers unresolved items from other retros in the same project", async () => {
    await seedActionItem({
      retrospectiveId: f.retroA.id,
      description: "still open",
      createdById: f.users.projA1Member.id,
    });
    await seedActionItem({
      retrospectiveId: f.retroA.id,
      description: "finished",
      createdById: f.users.projA1Member.id,
      status: "DONE",
    });
    // A different company entirely.
    await seedActionItem({
      retrospectiveId: f.retroB.id,
      description: "someone else's",
      createdById: f.users.outsiderB.id,
    });

    asUser(f.users.projA1Admin);
    const candidates = await listCarryOverCandidates(f.anonRetroA.id);

    expect(candidates.map((c) => c.description)).toEqual(["still open"]);
  });

  /**
   * The item stays where it was raised. Copying it would fork the record, and
   * the completion rate would then count the same work twice.
   */
  it("references the item rather than copying it", async () => {
    const item = await seedActionItem({
      retrospectiveId: f.retroA.id,
      description: "carry me",
      createdById: f.users.projA1Member.id,
    });
    asUser(f.users.projA1Admin);

    await carryOverActionItems({
      retrospectiveId: f.anonRetroA.id,
      actionItemIds: [item.id],
    });

    expect(await prisma.actionItem.count()).toBe(1);
    const after = await prisma.actionItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(after.retrospectiveId).toBe(f.retroA.id);
  });

  it("shows a carried item on the board that borrowed it", async () => {
    const item = await seedActionItem({
      retrospectiveId: f.retroA.id,
      description: "carry me",
      createdById: f.users.projA1Member.id,
    });
    asUser(f.users.projA1Admin);
    await carryOverActionItems({ retrospectiveId: f.anonRetroA.id, actionItemIds: [item.id] });

    const board = await getRetroBoard(f.anonRetroA.id);
    const carried = board.actionItems.find((a) => a.id === item.id);

    expect(carried).toBeTruthy();
    expect(carried?.isCarriedOver).toBe(true);
    expect(carried?.carriedCount).toBe(1);
  });

  /** Visible but untouchable would defeat the point of carrying it over. */
  it("lets a carried item be resolved from the borrowing board", async () => {
    const item = await seedActionItem({
      retrospectiveId: f.retroA.id,
      description: "carry me",
      createdById: f.users.projA1Member.id,
    });
    asUser(f.users.projA1Admin);
    await carryOverActionItems({ retrospectiveId: f.anonRetroA.id, actionItemIds: [item.id] });

    await expect(
      setActionItemStatus({
        retrospectiveId: f.anonRetroA.id,
        actionItemId: item.id,
        status: "DONE",
      }),
    ).resolves.toBeTruthy();
  });

  it("stamps the carry-over as reviewed once someone acts on it", async () => {
    const item = await seedActionItem({
      retrospectiveId: f.retroA.id,
      description: "carry me",
      createdById: f.users.projA1Member.id,
    });
    asUser(f.users.projA1Admin);
    await carryOverActionItems({ retrospectiveId: f.anonRetroA.id, actionItemIds: [item.id] });
    await setActionItemStatus({
      retrospectiveId: f.anonRetroA.id,
      actionItemId: item.id,
      status: "IN_PROGRESS",
    });

    const link = await prisma.retroCarryOver.findFirstOrThrow({ where: { actionItemId: item.id } });
    expect(link.reviewedAt).not.toBeNull();
  });

  it("refuses items from another company, even if their ids are supplied directly", async () => {
    const theirs = await seedActionItem({
      retrospectiveId: f.retroB.id,
      description: "not yours",
      createdById: f.users.outsiderB.id,
    });
    asUser(f.users.projA1Admin);

    await expect(
      carryOverActionItems({ retrospectiveId: f.retroA.id, actionItemIds: [theirs.id] }),
    ).rejects.toThrow(ForbiddenError);
    expect(await prisma.retroCarryOver.count()).toBe(0);
  });

  it("refuses a plain member", async () => {
    const item = await seedActionItem({
      retrospectiveId: f.retroA.id,
      description: "carry me",
      createdById: f.users.projA1Member.id,
    });
    asUser(f.users.projA1Member);

    await expect(
      carryOverActionItems({ retrospectiveId: f.anonRetroA.id, actionItemIds: [item.id] }),
    ).rejects.toThrow(ForbiddenError);
  });

  it("stops offering an item already on the board, and offers it again once dismissed", async () => {
    const item = await seedActionItem({
      retrospectiveId: f.retroA.id,
      description: "carry me",
      createdById: f.users.projA1Member.id,
    });
    asUser(f.users.projA1Admin);

    await carryOverActionItems({ retrospectiveId: f.anonRetroA.id, actionItemIds: [item.id] });
    expect(await listCarryOverCandidates(f.anonRetroA.id)).toHaveLength(0);

    await dismissCarryOver({ retrospectiveId: f.anonRetroA.id, actionItemIds: [item.id] });
    expect(await listCarryOverCandidates(f.anonRetroA.id)).toHaveLength(1);
  });
});

describe("my action items", () => {
  it("lists only what is assigned to me, and only what is outstanding", async () => {
    await seedActionItem({
      retrospectiveId: f.retroA.id,
      description: "mine, open",
      createdById: f.users.projA1Admin.id,
      assigneeIds: [f.users.projA1Member.id],
    });
    await seedActionItem({
      retrospectiveId: f.retroA.id,
      description: "mine, done",
      createdById: f.users.projA1Admin.id,
      assigneeIds: [f.users.projA1Member.id],
      status: "DONE",
    });
    await seedActionItem({
      retrospectiveId: f.retroA.id,
      description: "someone else's",
      createdById: f.users.projA1Admin.id,
      assigneeIds: [f.users.projA1Other.id],
    });

    asUser(f.users.projA1Member);
    const mine = await listMyActionItems();

    expect(mine.map((i) => i.description)).toEqual(["mine, open"]);
    expect(await countMyOpenActionItems()).toBe(1);
  });

  /**
   * The assignment row survives someone leaving a project. Visibility has to be
   * re-derived from live membership, or they keep seeing work belonging to a
   * team they are no longer on.
   */
  it("stops showing work from a project the person has left", async () => {
    await seedActionItem({
      retrospectiveId: f.retroA.id,
      description: "mine",
      createdById: f.users.projA1Admin.id,
      assigneeIds: [f.users.projA1Member.id],
    });

    asUser(f.users.projA1Member);
    expect(await listMyActionItems()).toHaveLength(1);

    await prisma.projectMembership.delete({
      where: {
        userId_projectId: { userId: f.users.projA1Member.id, projectId: f.projectA1.id },
      },
    });

    expect(await listMyActionItems()).toHaveLength(0);
    expect(await countMyOpenActionItems()).toBe(0);
  });

  it("gives a Super Admin no special access to other people's items", async () => {
    await seedActionItem({
      retrospectiveId: f.retroA.id,
      description: "not the super admin's",
      createdById: f.users.projA1Admin.id,
      assigneeIds: [f.users.projA1Member.id],
    });

    asUser(f.users.superAdmin);
    expect(await listMyActionItems()).toHaveLength(0);
  });

  it("orders by due date, soonest first, with undated work last", async () => {
    const soon = new Date(Date.now() + 86_400_000);
    const later = new Date(Date.now() + 5 * 86_400_000);
    await seedActionItem({
      retrospectiveId: f.retroA.id,
      description: "no date",
      createdById: f.users.projA1Admin.id,
      assigneeIds: [f.users.projA1Member.id],
    });
    await seedActionItem({
      retrospectiveId: f.retroA.id,
      description: "later",
      createdById: f.users.projA1Admin.id,
      assigneeIds: [f.users.projA1Member.id],
      dueDate: later,
    });
    await seedActionItem({
      retrospectiveId: f.retroA.id,
      description: "soon",
      createdById: f.users.projA1Admin.id,
      assigneeIds: [f.users.projA1Member.id],
      dueDate: soon,
    });

    asUser(f.users.projA1Member);
    const mine = await listMyActionItems();
    expect(mine.map((i) => i.description)).toEqual(["soon", "later", "no date"]);
  });
});

describe("action items raised from a card", () => {
  it("remembers which card it came from", async () => {
    const card = await prisma.retroCard.create({
      data: {
        columnId: f.retroA.columns[0].id,
        retrospectiveId: f.retroA.id,
        authorId: f.users.projA1Member.id,
        content: "the problem",
        order: 0,
      },
    });
    asUser(f.users.projA1Member);

    const item = await createActionItem({
      retrospectiveId: f.retroA.id,
      description: "the fix",
      sourceCardId: card.id,
    });

    expect(item.sourceCardId).toBe(card.id);
  });

  it("refuses a card from a different retro", async () => {
    const theirCard = await prisma.retroCard.create({
      data: {
        columnId: f.retroB.columns[0].id,
        retrospectiveId: f.retroB.id,
        authorId: f.users.outsiderB.id,
        content: "theirs",
        order: 0,
      },
    });
    asUser(f.users.projA1Member);

    await expect(
      createActionItem({
        retrospectiveId: f.retroA.id,
        description: "the fix",
        sourceCardId: theirCard.id,
      }),
    ).rejects.toThrow(NotFoundError);
  });
});
