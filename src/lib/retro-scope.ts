import "server-only";
import { prisma } from "@/lib/prisma";
import { ForbiddenError, NotFoundError } from "@/lib/authz";

/**
 * Proves that a child object actually belongs to the retrospective the caller
 * was authorized against.
 *
 * Every board action takes a `retrospectiveId` (which `requireRetroAccess`
 * checks) plus a second id naming what to change. Without these guards those
 * two were never tied together, so a legitimate member of one retro could pass
 * any other retro's card or action-item id as the target and mutate another
 * company's board.
 *
 * Guards rather than a scoped `where` clause, because roughly half the call
 * sites take the id as *create data* (`createCard`'s `columnId`, `moveCard`'s
 * `toColumnId`, `groupCards`' `ontoCardId`, `addComment`'s `cardId`) where a
 * where-clause has nothing to attach to. One mechanism everywhere beats two
 * that reviewers have to choose between. They also return the row, which
 * several callers need anyway for the author-or-moderator check.
 *
 * All of them throw NotFoundError — never ForbiddenError — when the target is
 * out of scope. A cross-tenant id must be indistinguishable from a deleted
 * one, or the guard itself becomes an existence oracle.
 */

export async function requireColumnInRetro(columnId: string, retrospectiveId: string) {
  const column = await prisma.retroColumn.findFirst({
    where: { id: columnId, retrospectiveId },
    select: { id: true },
  });
  if (!column) throw new NotFoundError("Column not found");
  return column;
}

export async function requireCardInRetro(cardId: string, retrospectiveId: string) {
  const card = await prisma.retroCard.findFirst({
    where: { id: cardId, column: { retrospectiveId } },
    select: { id: true, authorId: true, columnId: true, groupId: true },
  });
  if (!card) throw new NotFoundError("Card not found");
  return card;
}

export async function requireActionItemInRetro(actionItemId: string, retrospectiveId: string) {
  const item = await prisma.actionItem.findFirst({
    where: { id: actionItemId, retrospectiveId },
    select: { id: true, status: true, description: true, createdById: true },
  });
  if (!item) throw new NotFoundError("Action item not found");
  return item;
}

/**
 * A comment hangs off a card *or* an action item. The schema allows both or
 * neither (there is no DB constraint), so this is also where that invariant
 * gets enforced.
 */
export async function requireCommentTargetInRetro(
  target: { cardId?: string; actionItemId?: string },
  retrospectiveId: string,
): Promise<void> {
  const hasCard = Boolean(target.cardId);
  const hasActionItem = Boolean(target.actionItemId);
  if (hasCard === hasActionItem) {
    throw new ForbiddenError("A comment must belong to exactly one card or action item");
  }
  if (target.cardId) await requireCardInRetro(target.cardId, retrospectiveId);
  if (target.actionItemId) await requireActionItemInRetro(target.actionItemId, retrospectiveId);
}

/**
 * Assignees must be members of the project that owns the retro.
 *
 * Without this, `assigneeIds` went straight into a nested create and then into
 * a Microsoft Graph `sendMail` — an authenticated way to email any user on the
 * platform, from the company's own sender, with attacker-chosen body text.
 */
export async function requireUsersInProject(userIds: string[], projectId: string): Promise<void> {
  const unique = [...new Set(userIds)];
  if (unique.length === 0) return;

  const memberCount = await prisma.projectMembership.count({
    where: { projectId, userId: { in: unique } },
  });
  if (memberCount !== unique.length) {
    throw new ForbiddenError("Action items can only be assigned to members of this project");
  }
}
