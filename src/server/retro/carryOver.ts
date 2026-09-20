import "server-only";

/**
 * Carrying unresolved action items forward into a later retrospective.
 *
 * Plain server-only, not `"use server"` — see the note in ./lifecycle.ts.
 */

import { prisma } from "@/lib/prisma";
import { ForbiddenError, requireRetroAccess, requireRetroModerator } from "@/lib/authz";
import { UNRESOLVED_STATUSES } from "@/lib/actionItems";
import { revalidatePath } from "next/cache";
import { broadcastToRetro } from "@/lib/socket/emit";
import { USER_PUBLIC_SELECT } from "@/server/user-select";
import { parse } from "@/server/validation/parse";
import { carryOverInput, retroOnlyInput } from "@/server/validation/retros";

/**
 * Unresolved items from *other* retros in the same project.
 *
 * Scoped by the retro's own projectId, never one supplied by the caller — the
 * retro id is what was authorized, so it is what the scope has to come from.
 */
export async function listCarryOverCandidates(rawRetrospectiveId: string) {
  const { retrospectiveId } = parse(retroOnlyInput, { retrospectiveId: rawRetrospectiveId });
  const { retro } = await requireRetroAccess(retrospectiveId);

  return prisma.actionItem.findMany({
    where: {
      status: { in: [...UNRESOLVED_STATUSES] },
      retrospective: { projectId: retro.projectId, id: { not: retrospectiveId } },
      // Not already on this board.
      carryOvers: { none: { retrospectiveId } },
    },
    orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
    take: 50,
    select: {
      id: true,
      description: true,
      dueDate: true,
      status: true,
      createdAt: true,
      retrospective: { select: { id: true, title: true, createdAt: true } },
      assignees: { select: { user: USER_PUBLIC_SELECT } },
      _count: { select: { carryOvers: true } },
    },
  });
}

/** Pull selected items onto this board for another look. */
export async function carryOverActionItems(rawInput: {
  retrospectiveId: string;
  actionItemIds: string[];
}) {
  const input = parse(carryOverInput, rawInput);
  const { retro } = await requireRetroModerator(input.retrospectiveId);

  // Re-validated server-side rather than trusted: the ids came back from a
  // client that was shown a list, and "was shown a list" is not authorization.
  const eligible = await prisma.actionItem.findMany({
    where: {
      id: { in: input.actionItemIds },
      status: { in: [...UNRESOLVED_STATUSES] },
      retrospective: { projectId: retro.projectId, id: { not: input.retrospectiveId } },
    },
    select: { id: true },
  });

  if (eligible.length === 0) {
    throw new ForbiddenError("None of those action items can be carried onto this retrospective");
  }

  await prisma.retroCarryOver.createMany({
    data: eligible.map((item) => ({
      retrospectiveId: input.retrospectiveId,
      actionItemId: item.id,
    })),
    skipDuplicates: true,
  });

  broadcastToRetro(input.retrospectiveId, "carryOver:change", {});
  revalidatePath(`/retros/${input.retrospectiveId}`);
  return { carried: eligible.length };
}

/** Take an item back off this board. The item itself is untouched. */
export async function dismissCarryOver(rawInput: {
  retrospectiveId: string;
  actionItemIds: string[];
}) {
  const input = parse(carryOverInput, rawInput);
  await requireRetroModerator(input.retrospectiveId);

  await prisma.retroCarryOver.deleteMany({
    where: { retrospectiveId: input.retrospectiveId, actionItemId: { in: input.actionItemIds } },
  });

  broadcastToRetro(input.retrospectiveId, "carryOver:change", {});
  revalidatePath(`/retros/${input.retrospectiveId}`);
}

/** "Yes, we looked at it again" — without changing the item's status. */
export async function markCarryOverReviewed(rawInput: {
  retrospectiveId: string;
  actionItemIds: string[];
}) {
  const input = parse(carryOverInput, rawInput);
  await requireRetroAccess(input.retrospectiveId);

  await prisma.retroCarryOver.updateMany({
    where: {
      retrospectiveId: input.retrospectiveId,
      actionItemId: { in: input.actionItemIds },
      reviewedAt: null,
    },
    data: { reviewedAt: new Date() },
  });

  broadcastToRetro(input.retrospectiveId, "carryOver:change", {});
  revalidatePath(`/retros/${input.retrospectiveId}`);
}
