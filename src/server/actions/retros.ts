"use server";

/**
 * The Server Action boundary for the retro board.
 *
 * Every export here is a one-line wrapper that runs the corresponding mutation
 * in src/server/retro/mutations.ts and maps whatever it throws into an
 * ActionResult. That mapping has to happen on this side of the network: Next.js
 * replaces the message of an uncaught Server Action error with an opaque digest
 * in production, so a refusal thrown from here would reach the user as
 * "An error occurred in the Server Components render" no matter how carefully
 * it was worded.
 *
 * Keeping the wrappers uniform and logic-free is the point — there is nothing
 * to review in this file beyond "does each name line up".
 */

import * as retro from "@/server/retro/lifecycle";
import * as cards from "@/server/retro/cards";
import * as items from "@/server/retro/actionItems";
import * as carry from "@/server/retro/carryOver";
import * as phases from "@/server/retro/phases";
import * as health from "@/server/retro/health";
import { run, type ActionResult } from "@/server/actions/result";

type Args<T extends (...args: never[]) => unknown> = Parameters<T>;

export async function setRetroPhase(...args: Args<typeof phases.setRetroPhase>) {
  return run(() => phases.setRetroPhase(...args));
}

export async function stepRetroPhase(...args: Args<typeof phases.stepRetroPhase>) {
  return run(() => phases.stepRetroPhase(...args));
}

export async function configureRetroFlow(...args: Args<typeof phases.configureRetroFlow>) {
  return run(() => phases.configureRetroFlow(...args));
}

export async function transferFacilitation(...args: Args<typeof phases.transferFacilitation>) {
  return run(() => phases.transferFacilitation(...args));
}

export async function setDiscussionCard(...args: Args<typeof phases.setDiscussionCard>) {
  return run(() => phases.setDiscussionCard(...args));
}

export async function advanceDiscussion(...args: Args<typeof phases.advanceDiscussion>) {
  return run(() => phases.advanceDiscussion(...args));
}

export async function submitHealthCheckIn(...args: Args<typeof health.submitHealthCheckIn>) {
  return run(() => health.submitHealthCheckIn(...args));
}

export async function createRetrospective(...args: Args<typeof retro.createRetrospective>) {
  return run(() => retro.createRetrospective(...args));
}

export async function setRetroStatus(...args: Args<typeof retro.setRetroStatus>) {
  return run(() => retro.setRetroStatus(...args));
}

export async function deleteRetrospective(...args: Args<typeof retro.deleteRetrospective>) {
  return run(() => retro.deleteRetrospective(...args));
}

export async function startTimer(...args: Args<typeof retro.startTimer>) {
  return run(() => retro.startTimer(...args));
}

export async function stopTimer(...args: Args<typeof retro.stopTimer>) {
  return run(() => retro.stopTimer(...args));
}

export async function createCard(...args: Args<typeof cards.createCard>) {
  return run(() => cards.createCard(...args));
}

export async function updateCard(...args: Args<typeof cards.updateCard>) {
  return run(() => cards.updateCard(...args));
}

export async function deleteCard(...args: Args<typeof cards.deleteCard>) {
  return run(() => cards.deleteCard(...args));
}

export async function moveCard(...args: Args<typeof cards.moveCard>) {
  return run(() => cards.moveCard(...args));
}

export async function groupCards(...args: Args<typeof cards.groupCards>) {
  return run(() => cards.groupCards(...args));
}

export async function ungroupCard(...args: Args<typeof cards.ungroupCard>) {
  return run(() => cards.ungroupCard(...args));
}

export async function toggleVote(...args: Args<typeof cards.toggleVote>) {
  return run(() => cards.toggleVote(...args));
}

export async function toggleReaction(...args: Args<typeof cards.toggleReaction>) {
  return run(() => cards.toggleReaction(...args));
}

export async function addComment(...args: Args<typeof cards.addComment>) {
  return run(() => cards.addComment(...args));
}

export async function createActionItem(...args: Args<typeof items.createActionItem>) {
  return run(() => items.createActionItem(...args));
}

export async function setActionItemStatus(...args: Args<typeof items.setActionItemStatus>) {
  return run(() => items.setActionItemStatus(...args));
}

export async function carryOverActionItems(...args: Args<typeof carry.carryOverActionItems>) {
  return run(() => carry.carryOverActionItems(...args));
}

export async function dismissCarryOver(...args: Args<typeof carry.dismissCarryOver>) {
  return run(() => carry.dismissCarryOver(...args));
}

export async function markCarryOverReviewed(...args: Args<typeof carry.markCarryOverReviewed>) {
  return run(() => carry.markCarryOverReviewed(...args));
}

export async function updateActionItem(...args: Args<typeof items.updateActionItem>) {
  return run(() => items.updateActionItem(...args));
}

export async function updateActionItemAssignees(
  ...args: Args<typeof items.updateActionItemAssignees>
) {
  return run(() => items.updateActionItemAssignees(...args));
}

export async function deleteActionItem(...args: Args<typeof items.deleteActionItem>) {
  return run(() => items.deleteActionItem(...args));
}

export type { ActionResult };
