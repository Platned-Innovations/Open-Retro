import "server-only";

/**
 * Action items: the follow-up work a retro produces.
 *
 * Plain server-only, not `"use server"` — see the note in ./lifecycle.ts.
 */

import { prisma } from "@/lib/prisma";
import { requireRetroAccess, assertRetroWritable, NotFoundError } from "@/lib/authz";
import type { ActionItemStatus } from "@/generated/prisma/client";
import { requireRetroCapability } from "@/server/retro/guards";
import { requireActionItemInRetro, requireCardInRetro, requireUsersInProject } from "@/lib/retro-scope";
import { revalidatePath } from "next/cache";
import { broadcastToRetro } from "@/lib/socket/emit";
import { notifyAssigned, notifyCompleted, notifyUnassigned } from "@/server/retro/notify";
import { USER_PUBLIC_SELECT } from "@/server/user-select";
import { parse } from "@/server/validation/parse";
import {
  createActionItemInput,
  retroChildInput,
  setActionItemStatusInput,
  updateActionItemAssigneesInput,
  updateActionItemInput,
} from "@/server/validation/retros";


export async function createActionItem(rawInput: {
  retrospectiveId: string;
  description: string;
  assigneeIds?: string[];
  dueDate?: Date;
  sourceCardId?: string;
}) {
  const input = parse(createActionItemInput, rawInput);
  const { user, retro } = await requireRetroCapability(input.retrospectiveId, "createActionItem");
  const assigneeIds = [...new Set(input.assigneeIds ?? [])];
  await requireUsersInProject(assigneeIds, retro.projectId);
  if (input.sourceCardId) await requireCardInRetro(input.sourceCardId, input.retrospectiveId);

  const item = await prisma.actionItem.create({
    data: {
      retrospectiveId: input.retrospectiveId,
      description: input.description,
      dueDate: input.dueDate,
      sourceCardId: input.sourceCardId,
      createdById: user.id,
      assignees: { create: assigneeIds.map((userId) => ({ userId })) },
    },
    include: {
      assignees: { select: { userId: true, user: USER_PUBLIC_SELECT } },
      createdBy: USER_PUBLIC_SELECT,
      retrospective: { select: { title: true } },
    },
  });
  broadcastToRetro(input.retrospectiveId, "actionItem:create", { actionItemId: item.id });
  revalidatePath(`/retros/${input.retrospectiveId}`);

  await notifyAssigned(assigneeIds, user, item.retrospective.title, item.description, input.retrospectiveId);

  return item;
}

/**
 * Moves an item to a new status.
 *
 * Replaces the old done/not-done toggle. An item can legitimately be resolved
 * from a *later* board than the one that raised it, which is the whole point of
 * carry-over — so the scope check accepts either.
 */
export async function setActionItemStatus(rawInput: {
  retrospectiveId: string;
  actionItemId: string;
  status: ActionItemStatus;
}) {
  const input = parse(setActionItemStatusInput, rawInput);
  const { user, retro } = await requireRetroAccess(input.retrospectiveId);
  const current = await requireActionItemInScope(input.actionItemId, input.retrospectiveId);
  await assertRetroWritable(retro, user);

  const becomingDone = input.status === "DONE" && current.status !== "DONE";

  const item = await prisma.actionItem.update({
    where: { id: input.actionItemId },
    data: {
      status: input.status,
      // Stamped only on the transition *into* DONE, so re-saving a finished
      // item neither moves the date nor re-sends the notification.
      ...(becomingDone ? { completedAt: new Date() } : {}),
      ...(input.status !== "DONE" ? { completedAt: null } : {}),
    },
    include: {
      assignees: { select: { userId: true, user: USER_PUBLIC_SELECT } },
      retrospective: { select: { title: true } },
    },
  });

  // Looking at it again is the point of carrying it over, so acting on it
  // counts as having reviewed it.
  await prisma.retroCarryOver.updateMany({
    where: { actionItemId: input.actionItemId, retrospectiveId: input.retrospectiveId, reviewedAt: null },
    data: { reviewedAt: new Date() },
  });

  broadcastToRetro(input.retrospectiveId, "actionItem:update", { actionItemId: input.actionItemId });
  revalidatePath(`/retros/${input.retrospectiveId}`);

  if (becomingDone) {
    await notifyCompleted(
      item.assignees.map((a) => a.userId),
      user,
      item.retrospective.title,
      item.description,
      input.retrospectiveId,
    );
  }

  return item;
}

/**
 * An action item belongs to this retro, *or* has been carried onto it.
 *
 * `requireActionItemInRetro` alone would refuse the carried case, which would
 * make a carried item visible but untouchable — the opposite of the point.
 */
async function requireActionItemInScope(actionItemId: string, retrospectiveId: string) {
  const item = await prisma.actionItem.findFirst({
    where: {
      id: actionItemId,
      OR: [{ retrospectiveId }, { carryOvers: { some: { retrospectiveId } } }],
    },
    select: { id: true, status: true, description: true, retrospectiveId: true },
  });
  if (!item) throw new NotFoundError("Action item not found");
  return item;
}

export async function updateActionItem(rawInput: {
  retrospectiveId: string;
  actionItemId: string;
  description?: string;
  dueDate?: Date | null;
}) {
  const input = parse(updateActionItemInput, rawInput);
  const { user, retro } = await requireRetroAccess(input.retrospectiveId);
  await requireActionItemInRetro(input.actionItemId, input.retrospectiveId);
  await assertRetroWritable(retro, user);

  const item = await prisma.actionItem.update({
    where: { id: input.actionItemId, retrospectiveId: input.retrospectiveId },
    data: {
      description: input.description,
      dueDate: input.dueDate,
    },
    include: { assignees: { select: { userId: true, user: USER_PUBLIC_SELECT } } },
  });
  broadcastToRetro(input.retrospectiveId, "actionItem:update", { actionItemId: input.actionItemId });
  revalidatePath(`/retros/${input.retrospectiveId}`);
  return item;
}

/** Diffs the requested assignee list against the current one, applies it, and emails only what changed. */
export async function updateActionItemAssignees(
  rawRetrospectiveId: string,
  rawActionItemId: string,
  rawAssigneeIds: string[],
) {
  const { retrospectiveId, actionItemId, assigneeIds } = parse(updateActionItemAssigneesInput, {
    retrospectiveId: rawRetrospectiveId,
    actionItemId: rawActionItemId,
    assigneeIds: rawAssigneeIds,
  });
  const { user, retro } = await requireRetroAccess(retrospectiveId);
  await requireActionItemInRetro(actionItemId, retrospectiveId);
  await assertRetroWritable(retro, user);
  await requireUsersInProject(assigneeIds, retro.projectId);

  const nextIds = new Set(assigneeIds);

  const current = await prisma.actionItemAssignee.findMany({
    where: { actionItemId },
    select: { userId: true },
  });
  const currentIds = new Set(current.map((a) => a.userId));

  const toAdd = [...nextIds].filter((id) => !currentIds.has(id));
  const toRemove = current.map((a) => a.userId).filter((id) => !nextIds.has(id));

  const item = await prisma.$transaction(async (tx) => {
    if (toRemove.length > 0) {
      await tx.actionItemAssignee.deleteMany({
        where: { actionItemId, userId: { in: toRemove } },
      });
    }
    if (toAdd.length > 0) {
      await tx.actionItemAssignee.createMany({ data: toAdd.map((userId) => ({ actionItemId, userId })) });
    }
    return tx.actionItem.findUniqueOrThrow({
      where: { id: actionItemId },
      include: {
        assignees: { select: { userId: true, user: USER_PUBLIC_SELECT } },
        retrospective: { select: { title: true } },
      },
    });
  });

  broadcastToRetro(retrospectiveId, "actionItem:update", { actionItemId });
  revalidatePath(`/retros/${retrospectiveId}`);

  await notifyAssigned(toAdd, user, item.retrospective.title, item.description, retrospectiveId);
  await notifyUnassigned(toRemove, user, item.retrospective.title, item.description, retrospectiveId);

  return item;
}

export async function deleteActionItem(rawRetrospectiveId: string, rawActionItemId: string) {
  const { retrospectiveId, childId: actionItemId } = parse(retroChildInput, {
    retrospectiveId: rawRetrospectiveId,
    childId: rawActionItemId,
  });
  const { user, retro } = await requireRetroAccess(retrospectiveId);
  await requireActionItemInRetro(actionItemId, retrospectiveId);
  await assertRetroWritable(retro, user);

  await prisma.actionItem.delete({ where: { id: actionItemId, retrospectiveId } });
  broadcastToRetro(retrospectiveId, "actionItem:delete", { actionItemId });
  revalidatePath(`/retros/${retrospectiveId}`);
}
