import "server-only";

/**
 * Moving the session through its phases.
 *
 * Plain server-only, not `"use server"` — see the note in ./lifecycle.ts.
 */

import type { RetroPhase } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { ForbiddenError, NotFoundError, requireRetroModerator } from "@/lib/authz";
import { requireCardInRetro } from "@/lib/retro-scope";
import { PHASE_DEFAULT_TIMER_SECONDS, nextPhase, previousPhase } from "@/lib/retroPhases";
import { effectiveVoteCount } from "@/lib/retroVotes";
import { revalidatePath } from "next/cache";
import { broadcastToRetro } from "@/lib/socket/emit";
import { parse } from "@/server/validation/parse";
import {
  configureRetroFlowInput,
  setDiscussionCardInput,
  setRetroPhaseInput,
  transferFacilitationInput,
} from "@/server/validation/retros";

/**
 * The cards the group works through during DISCUSS, most-voted first.
 *
 * Computed on the server and nowhere else, so everyone's "next" is the same
 * card — a client-side ordering would drift the moment two people had slightly
 * different data, and the facilitator would be talking about one card while
 * half the room looked at another.
 */
async function discussionOrder(retrospectiveId: string): Promise<string[]> {
  const cards = await prisma.retroCard.findMany({
    where: { retrospectiveId, groupId: null },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      _count: { select: { votes: true } },
      grouped: { select: { _count: { select: { votes: true } } } },
    },
  });

  const scored = cards.map((card) => ({
    id: card.id,
    score: effectiveVoteCount({
      voteCount: card._count.votes,
      grouped: card.grouped.map((g) => ({ voteCount: g._count.votes })),
    }),
  }));

  // If nobody voted at all, walking the cards in the order they were written is
  // better than refusing to start a discussion.
  const anyVotes = scored.some((c) => c.score > 0);
  const relevant = anyVotes ? scored.filter((c) => c.score > 0) : scored;

  // createdAt asc is already the tiebreak, since findMany returned them that way.
  return [...relevant].sort((a, b) => b.score - a.score).map((c) => c.id);
}

/** Restarts the shared countdown, or clears it when a phase has no suggested box. */
async function applyPhaseTimer(retrospectiveId: string, seconds: number | undefined) {
  if (seconds === undefined) {
    await prisma.retrospective.update({
      where: { id: retrospectiveId },
      data: { timerSeconds: null, timerEndsAt: null },
    });
    broadcastToRetro(retrospectiveId, "timer:stop", {});
    return;
  }

  const timerEndsAt = new Date(Date.now() + seconds * 1000);
  await prisma.retrospective.update({
    where: { id: retrospectiveId },
    data: { timerSeconds: seconds, timerEndsAt },
  });
  broadcastToRetro(retrospectiveId, "timer:start", { timerEndsAt: timerEndsAt.toISOString() });
}

/**
 * Moves the retro to a new phase.
 *
 * `from` is the phase the caller believed it was in. Two moderators both
 * clicking "Next" should advance one step, not two, so the update is
 * conditional on that belief still holding — and a no-op is reported as
 * success, because from the second clicker's point of view the board did go
 * where they asked.
 */
export async function setRetroPhase(rawInput: {
  retrospectiveId: string;
  to: RetroPhase;
  from: RetroPhase;
}) {
  const input = parse(setRetroPhaseInput, rawInput);
  const { retro } = await requireRetroModerator(input.retrospectiveId);

  const now = new Date();
  const leavingCollect = input.from === "COLLECT" && input.to !== "COLLECT";

  const { count } = await prisma.retrospective.updateMany({
    where: { id: input.retrospectiveId, phase: input.from },
    data: {
      phase: input.to,
      phaseStartedAt: now,
      // A one-way latch. Once the board has been read, re-entering COLLECT
      // must not pretend the words can be unseen.
      ...(leavingCollect && retro.collectRevealedAt === null ? { collectRevealedAt: now } : {}),
      // CLOSED and the COMPLETED status are the same statement made twice;
      // keep them in step so neither can contradict the other.
      ...(input.to === "CLOSED" ? { status: "COMPLETED" as const, endedAt: now } : {}),
      ...(input.from === "CLOSED" ? { status: "ACTIVE" as const, endedAt: null } : {}),
    },
  });

  if (count === 0) {
    const current = await prisma.retrospective.findUniqueOrThrow({
      where: { id: input.retrospectiveId },
      select: { phase: true },
    });
    return { phase: current.phase, alreadyThere: true };
  }

  if (input.to === "DISCUSS") {
    const [firstCardId] = await discussionOrder(input.retrospectiveId);
    await prisma.retrospective.update({
      where: { id: input.retrospectiveId },
      data: { discussCardId: firstCardId ?? null },
    });
  }

  await applyPhaseTimer(input.retrospectiveId, PHASE_DEFAULT_TIMER_SECONDS[input.to]);

  broadcastToRetro(input.retrospectiveId, "phase:change", { phase: input.to });
  revalidatePath(`/retros/${input.retrospectiveId}`);
  return { phase: input.to, alreadyThere: false };
}

/** Step the guided flow forwards or backwards by one. */
export async function stepRetroPhase(rawInput: {
  retrospectiveId: string;
  direction: "next" | "previous";
}) {
  const { retro } = await requireRetroModerator(rawInput.retrospectiveId);
  const options = { checkInEnabled: retro.checkInEnabled };
  const to =
    rawInput.direction === "next"
      ? nextPhase(retro.phase, options)
      : previousPhase(retro.phase, options);

  if (!to) {
    throw new ForbiddenError(
      rawInput.direction === "next"
        ? "This retrospective is already at its last step"
        : "This retrospective is already at its first step",
    );
  }

  return setRetroPhase({ retrospectiveId: rawInput.retrospectiveId, to, from: retro.phase });
}

export async function configureRetroFlow(rawInput: {
  retrospectiveId: string;
  isGuided?: boolean;
  voteBudget?: number;
  hideOthersCards?: boolean;
  hideVoteCounts?: boolean;
  checkInEnabled?: boolean;
  discussSeconds?: number;
}) {
  const input = parse(configureRetroFlowInput, rawInput);
  const { retro } = await requireRetroModerator(input.retrospectiveId);

  // Refusing outright is the honest answer. Accepting the toggle and quietly
  // not applying it would tell people their words are private when they have
  // already been read.
  if (input.hideOthersCards === true && retro.collectRevealedAt !== null) {
    throw new ForbiddenError(
      "Cards on this board have already been revealed — hiding them again wouldn't un-see them",
    );
  }

  const { retrospectiveId, ...settings } = input;
  await prisma.retrospective.update({ where: { id: retrospectiveId }, data: settings });

  broadcastToRetro(retrospectiveId, "phase:change", { phase: retro.phase });
  revalidatePath(`/retros/${retrospectiveId}`);
}

/**
 * Hands the session to someone else.
 *
 * With only the facilitator able to advance phases, a facilitator who drops off
 * the call freezes the retro for everyone. Project and company admins already
 * count as moderators, but a team with no admin in the room needs this.
 */
export async function transferFacilitation(rawInput: {
  retrospectiveId: string;
  toUserId: string;
}) {
  const input = parse(transferFacilitationInput, rawInput);
  const { retro } = await requireRetroModerator(input.retrospectiveId);

  const membership = await prisma.projectMembership.findUnique({
    where: { userId_projectId: { userId: input.toUserId, projectId: retro.projectId } },
  });
  if (!membership) {
    throw new NotFoundError("That person isn't a member of this project");
  }

  await prisma.retrospective.update({
    where: { id: input.retrospectiveId },
    data: { facilitatorId: input.toUserId },
  });

  broadcastToRetro(input.retrospectiveId, "phase:change", { phase: retro.phase });
  revalidatePath(`/retros/${input.retrospectiveId}`);
}

/** Point the group at a specific card during DISCUSS. */
export async function setDiscussionCard(rawInput: {
  retrospectiveId: string;
  cardId: string | null;
}) {
  const input = parse(setDiscussionCardInput, rawInput);
  const { retro } = await requireRetroModerator(input.retrospectiveId);

  if (input.cardId) await requireCardInRetro(input.cardId, input.retrospectiveId);

  await markDiscussed(retro.discussCardId, input.cardId);
  await prisma.retrospective.update({
    where: { id: input.retrospectiveId },
    data: { discussCardId: input.cardId },
  });

  await applyPhaseTimer(input.retrospectiveId, retro.discussSeconds);
  broadcastToRetro(input.retrospectiveId, "discuss:change", { cardId: input.cardId });
  revalidatePath(`/retros/${input.retrospectiveId}`);
}

/** Walk to the next or previous card in the server-decided discussion order. */
export async function advanceDiscussion(rawInput: {
  retrospectiveId: string;
  direction: "next" | "previous";
}) {
  const { retro } = await requireRetroModerator(rawInput.retrospectiveId);
  const order = await discussionOrder(rawInput.retrospectiveId);
  if (order.length === 0) return;

  const currentIndex = retro.discussCardId ? order.indexOf(retro.discussCardId) : -1;
  const nextIndex =
    rawInput.direction === "next"
      ? Math.min(currentIndex + 1, order.length - 1)
      : Math.max(currentIndex - 1, 0);

  const cardId = order[nextIndex];
  if (cardId === retro.discussCardId) return;

  await setDiscussionCard({ retrospectiveId: rawInput.retrospectiveId, cardId });
}

/** Stamps the card the group has just finished with, for the summary and insights. */
async function markDiscussed(previousCardId: string | null, nextCardId: string | null) {
  if (!previousCardId || previousCardId === nextCardId) return;
  await prisma.retroCard.update({
    where: { id: previousCardId },
    data: { discussedAt: new Date() },
  });
}

/** The discussion running order, for the UI's "3 of 8" progress. */
export async function getDiscussionOrder(retrospectiveId: string) {
  await requireRetroModerator(retrospectiveId);
  return discussionOrder(retrospectiveId);
}
