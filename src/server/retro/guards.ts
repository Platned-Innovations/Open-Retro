import "server-only";
import type { RetroPhase } from "@/generated/prisma/client";
import {
  ForbiddenError,
  assertRetroWritable,
  isRetroModerator,
  requireRetroAccess,
  type RetroContext,
  type SessionUser,
} from "@/lib/authz";
import { PHASE_LABELS, canInPhase, type RetroCapability } from "@/lib/retroPhases";

/** Says what is happening and what to do about it, rather than just "no". */
function phaseRefusal(phase: RetroPhase, capability: RetroCapability): string {
  const activity: Record<RetroCapability, string> = {
    submitCheckIn: "checking in",
    createCard: "adding cards",
    editOwnCard: "editing cards",
    moveCard: "moving cards",
    groupCard: "merging cards",
    vote: "voting",
    comment: "commenting",
    react: "reacting",
    createActionItem: "adding action items",
  };
  return (
    `${PHASE_LABELS[phase]} is in progress — ${activity[capability]} isn't part of this step. ` +
    "The facilitator moves everyone on together."
  );
}

/**
 * The single gate every board mutation passes through.
 *
 * Composes the checks that already existed — are you a member, is the board
 * still writable — with the phase rule, so no action can end up enforcing two
 * of the three.
 *
 * Moderators bypass the *phase* gate and nothing else. A facilitator fixing a
 * typo during VOTE shouldn't have to rewind the session to do it. They still
 * never see a card that safe ideation is hiding: that concealment lives in
 * getRetroBoard, where no bypass reaches it.
 */
export async function requireRetroCapability(
  retrospectiveId: string,
  capability: RetroCapability,
): Promise<{ user: SessionUser; retro: RetroContext; isModerator: boolean }> {
  const { user, retro } = await requireRetroAccess(retrospectiveId);
  await assertRetroWritable(retro, user);

  if (canInPhase(capability, retro)) {
    // Still resolved, because callers use it for ownership decisions.
    return { user, retro, isModerator: await isRetroModerator(user, retro) };
  }

  const isModerator = await isRetroModerator(user, retro);
  if (isModerator) return { user, retro, isModerator };

  throw new ForbiddenError(phaseRefusal(retro.phase, capability));
}
