import "server-only";

/**
 * Cards, and everything attached to one: votes, reactions and comments.
 *
 * Plain server-only, not `"use server"` — see the note in ./lifecycle.ts.
 */

import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { isRetroModerator, ForbiddenError } from "@/lib/authz";
import { requireRetroCapability } from "@/server/retro/guards";
import {
  requireCardInRetro,
  requireColumnInRetro,
  requireCommentTargetInRetro,
} from "@/lib/retro-scope";
import { reorder } from "@/lib/cardOrder";
import { revalidatePath } from "next/cache";
import { broadcastToRetro } from "@/lib/socket/emit";
import { notifyMentions } from "@/server/retro/notify";
import { USER_PUBLIC_SELECT } from "@/server/user-select";
import { parse } from "@/server/validation/parse";
import {
  addCommentInput,
  createCardInput,
  groupCardsInput,
  moveCardInput,
  retroChildInput,
  toggleReactionInput,
  updateCardInput,
} from "@/server/validation/retros";

export async function createCard(rawInput: {
  retrospectiveId: string;
  columnId: string;
  content: string;
}) {
  const input = parse(createCardInput, rawInput);
  const { user } = await requireRetroCapability(input.retrospectiveId, "createCard");
  await requireColumnInRetro(input.columnId, input.retrospectiveId);

  // Read the last position and write inside one transaction. A `count()`
  // followed by a separate `create({ order: count })` is not atomic, and in a
  // live retro several people add a card to the same column at the same moment
  // — they all read the same count and all wrote the same `order`. The board's
  // `[order, createdAt]` sort keeps any residual tie deterministic.
  const card = await prisma.$transaction(async (tx) => {
    const last = await tx.retroCard.findFirst({
      where: { columnId: input.columnId },
      orderBy: { order: "desc" },
      select: { order: true },
    });
    return tx.retroCard.create({
      data: {
        columnId: input.columnId,
        retrospectiveId: input.retrospectiveId,
        authorId: user.id,
        content: input.content,
        order: (last?.order ?? -1) + 1,
      },
      include: { author: USER_PUBLIC_SELECT, votes: true, comments: true, reactions: true, grouped: true },
    });
  });
  broadcastToRetro(input.retrospectiveId, "card:create", { columnId: input.columnId });
  revalidatePath(`/retros/${input.retrospectiveId}`);
  return card;
}

/** Editing someone else's words is a moderator act, not an ordinary one. */
async function assertCanEditCard(
  card: { authorId: string | null },
  user: { id: string; role: "SUPER_ADMIN" | "USER" },
  retro: { facilitatorId: string; projectId: string; companyId: string },
) {
  if (card.authorId === user.id) return;
  if (await isRetroModerator(user, retro)) return;
  throw new ForbiddenError("Only the card's author or a moderator can change it");
}

export async function updateCard(
  rawRetrospectiveId: string,
  rawCardId: string,
  rawContent: string,
) {
  const { retrospectiveId, cardId, content } = parse(updateCardInput, {
    retrospectiveId: rawRetrospectiveId,
    cardId: rawCardId,
    content: rawContent,
  });
  const { user, retro } = await requireRetroCapability(retrospectiveId, "editOwnCard");
  const existing = await requireCardInRetro(cardId, retrospectiveId);
  await assertCanEditCard(existing, user, retro);

  const card = await prisma.retroCard.update({
    // Scoped as well as guarded: belt-and-braces, so a future caller that
    // forgets the guard still cannot reach across retros.
    where: { id: cardId, column: { retrospectiveId } },
    data: { content },
  });
  broadcastToRetro(retrospectiveId, "card:update", { cardId });
  revalidatePath(`/retros/${retrospectiveId}`);
  return card;
}

export async function deleteCard(rawRetrospectiveId: string, rawCardId: string) {
  const { retrospectiveId, childId: cardId } = parse(retroChildInput, {
    retrospectiveId: rawRetrospectiveId,
    childId: rawCardId,
  });
  const { user, retro } = await requireRetroCapability(retrospectiveId, "editOwnCard");
  const existing = await requireCardInRetro(cardId, retrospectiveId);
  await assertCanEditCard(existing, user, retro);

  await prisma.retroCard.delete({ where: { id: cardId, column: { retrospectiveId } } });
  broadcastToRetro(retrospectiveId, "card:delete", { cardId });
  revalidatePath(`/retros/${retrospectiveId}`);
}

/** Move a card to a (possibly different) column at a given index; reorders siblings. */
export async function moveCard(rawInput: {
  retrospectiveId: string;
  cardId: string;
  toColumnId: string;
  toIndex: number;
}) {
  const input = parse(moveCardInput, rawInput);
  await requireRetroCapability(input.retrospectiveId, "moveCard");
  await requireCardInRetro(input.cardId, input.retrospectiveId);
  await requireColumnInRetro(input.toColumnId, input.retrospectiveId);

  // Top-level only (`groupId: null`), so this list is the same one the browser
  // computed `toIndex` against — merged children are not rendered as separate
  // positions, and counting them here shifted every drop.
  const siblings = await prisma.retroCard.findMany({
    where: { columnId: input.toColumnId, groupId: null },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    select: { id: true },
  });

  const ordered = reorder(
    siblings.map((c) => c.id),
    input.cardId,
    input.toIndex,
  );

  await prisma.$transaction(
    ordered.map((id, i) =>
      prisma.retroCard.update({
        where: { id },
        data: { order: i, ...(id === input.cardId ? { columnId: input.toColumnId } : {}) },
      }),
    ),
  );

  broadcastToRetro(input.retrospectiveId, "card:move", { cardId: input.cardId, toColumnId: input.toColumnId });
  revalidatePath(`/retros/${input.retrospectiveId}`);
}

/** Stack one card under another (merge duplicates raised by different people). */
export async function groupCards(
  rawRetrospectiveId: string,
  rawCardId: string,
  rawOntoCardId: string,
) {
  const { retrospectiveId, cardId, ontoCardId } = parse(groupCardsInput, {
    retrospectiveId: rawRetrospectiveId,
    cardId: rawCardId,
    ontoCardId: rawOntoCardId,
  });
  await requireRetroCapability(retrospectiveId, "groupCard");
  await requireCardInRetro(cardId, retrospectiveId);
  const onto = await requireCardInRetro(ontoCardId, retrospectiveId);

  if (cardId === ontoCardId) {
    throw new ForbiddenError("A card can't be merged into itself");
  }
  // The board renders one level of stacking (a lead card plus its children),
  // so merging onto a card that is itself merged would hide the result.
  if (onto.groupId) {
    throw new ForbiddenError("That card is already merged into another one — merge into the top card instead");
  }

  await prisma.retroCard.update({
    where: { id: cardId, column: { retrospectiveId } },
    data: { groupId: ontoCardId },
  });
  broadcastToRetro(retrospectiveId, "card:update", { cardId });
  revalidatePath(`/retros/${retrospectiveId}`);
}

export async function ungroupCard(rawRetrospectiveId: string, rawCardId: string) {
  const { retrospectiveId, childId: cardId } = parse(retroChildInput, {
    retrospectiveId: rawRetrospectiveId,
    childId: rawCardId,
  });
  await requireRetroCapability(retrospectiveId, "groupCard");
  await requireCardInRetro(cardId, retrospectiveId);

  await prisma.retroCard.update({
    where: { id: cardId, column: { retrospectiveId } },
    data: { groupId: null },
  });
  broadcastToRetro(retrospectiveId, "card:update", { cardId });
  revalidatePath(`/retros/${retrospectiveId}`);
}

// --- Votes -----------------------------------------------------------------

export async function toggleVote(rawRetrospectiveId: string, rawCardId: string) {
  const { retrospectiveId, childId: cardId } = parse(retroChildInput, {
    retrospectiveId: rawRetrospectiveId,
    childId: rawCardId,
  });
  const { user, retro } = await requireRetroCapability(retrospectiveId, "vote");
  await requireCardInRetro(cardId, retrospectiveId);

  // Removing a vote never needs a budget check, and `deleteMany` reports how
  // many rows it took, so the add-or-remove decision stays a single atomic
  // statement. The previous read-then-write raced against itself on a
  // double-click and surfaced the (cardId, userId) unique violation as a raw
  // Prisma P2002.
  const removed = await prisma.cardVote.deleteMany({ where: { cardId, userId: user.id } });
  if (removed.count > 0) {
    broadcastToRetro(retrospectiveId, "vote:toggle", { cardId });
    revalidatePath(`/retros/${retrospectiveId}`);
    return;
  }

  if (retro.voteBudget > 0) {
    // Counting and inserting have to be one atomic decision, or two tabs each
    // read "4 used" and both insert a fifth vote. Serializable is the only
    // isolation level that actually prevents that here; P2034 is Postgres
    // saying it detected the conflict, which is a retry, not a failure.
    await withSerializableRetry(async () => {
      await prisma.$transaction(
        async (tx) => {
          const used = await tx.cardVote.count({ where: { retrospectiveId, userId: user.id } });
          if (used >= retro.voteBudget) {
            throw new ForbiddenError(
              `You've used all ${retro.voteBudget} of your votes — take one back to move it somewhere else`,
            );
          }
          await tx.cardVote.create({ data: { cardId, retrospectiveId, userId: user.id } });
        },
        { isolationLevel: "Serializable" },
      );
    });
  } else {
    await prisma.cardVote.createMany({
      data: { cardId, retrospectiveId, userId: user.id },
      skipDuplicates: true,
    });
  }

  broadcastToRetro(retrospectiveId, "vote:toggle", { cardId });
  revalidatePath(`/retros/${retrospectiveId}`);
}

/**
 * Retries once on a Postgres serialization failure.
 *
 * Serializable transactions abort rather than block when two of them conflict,
 * so a retry is the expected handling, not error recovery. One attempt is
 * enough: the window is a single indexed count plus an insert, and a second
 * conflict on the same pair of clicks is vanishingly unlikely.
 */
async function withSerializableRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    const isSerializationFailure =
      error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034";
    if (!isSerializationFailure) throw error;
    return fn();
  }
}

// --- Comments & reactions ----------------------------------------------------

export async function addComment(rawInput: {
  retrospectiveId: string;
  cardId?: string;
  actionItemId?: string;
  content: string;
}) {
  const input = parse(addCommentInput, rawInput);
  const { user } = await requireRetroCapability(input.retrospectiveId, "comment");
  await requireCommentTargetInRetro(input, input.retrospectiveId);

  const comment = await prisma.comment.create({
    data: {
      cardId: input.cardId,
      actionItemId: input.actionItemId,
      authorId: user.id,
      content: input.content,
    },
    include: { author: USER_PUBLIC_SELECT },
  });
  broadcastToRetro(input.retrospectiveId, "comment:create", { cardId: input.cardId ?? null });
  revalidatePath(`/retros/${input.retrospectiveId}`);

  await notifyMentions({
    retrospectiveId: input.retrospectiveId,
    content: input.content,
    authorId: user.id,
    authorName: user.name,
  });

  return comment;
}

export async function toggleReaction(
  rawRetrospectiveId: string,
  rawCardId: string,
  rawEmoji: string,
) {
  const { retrospectiveId, cardId, emoji } = parse(toggleReactionInput, {
    retrospectiveId: rawRetrospectiveId,
    cardId: rawCardId,
    emoji: rawEmoji,
  });
  const { user } = await requireRetroCapability(retrospectiveId, "react");
  await requireCardInRetro(cardId, retrospectiveId);

  // Single-statement toggle, for the same reason as toggleVote above.
  const removed = await prisma.reaction.deleteMany({ where: { cardId, userId: user.id, emoji } });
  if (removed.count === 0) {
    await prisma.reaction.createMany({
      data: { cardId, userId: user.id, emoji },
      skipDuplicates: true,
    });
  }
  broadcastToRetro(retrospectiveId, "reaction:toggle", { cardId });
  revalidatePath(`/retros/${retrospectiveId}`);
}
