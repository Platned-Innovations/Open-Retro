import type { RetroPhase } from "@/generated/prisma/client";

/**
 * The rules of the guided session, in one place.
 *
 * Deliberately pure and free of `server-only`, exactly like retroTemplates.ts:
 * the server enforces these and the components read the same table to decide
 * what to disable. A UI that offers an action the server will refuse is worse
 * than one that hides it, and two copies of the rule drift.
 */

export const PHASE_ORDER = [
  "LOBBY",
  "CHECK_IN",
  "COLLECT",
  "GROUP",
  "VOTE",
  "DISCUSS",
  "ACTIONS",
  "CLOSED",
] as const satisfies readonly RetroPhase[];

/** Everything a participant might try to do on a board. */
export type RetroCapability =
  | "submitCheckIn"
  | "createCard"
  | "editOwnCard"
  | "moveCard"
  | "groupCard"
  | "vote"
  | "comment"
  | "react"
  | "createActionItem";

/**
 * What each phase permits.
 *
 * The narrowness is the feature. Collecting while other people are voting is
 * how a retro turns into everyone doing something different at once, which is
 * the thing a facilitator otherwise spends the meeting preventing by hand.
 */
export const PHASE_CAPABILITIES: Record<RetroPhase, readonly RetroCapability[]> = {
  LOBBY: [],
  CHECK_IN: ["submitCheckIn"],
  COLLECT: ["createCard", "editOwnCard"],
  GROUP: ["moveCard", "groupCard", "editOwnCard"],
  VOTE: ["vote"],
  DISCUSS: ["comment", "react", "createActionItem"],
  ACTIONS: ["createActionItem", "comment"],
  CLOSED: [],
};

export const PHASE_LABELS: Record<RetroPhase, string> = {
  LOBBY: "Lobby",
  CHECK_IN: "Check in",
  COLLECT: "Collect",
  GROUP: "Group",
  VOTE: "Vote",
  DISCUSS: "Discuss",
  ACTIONS: "Actions",
  CLOSED: "Closed",
};

/** One line of facilitator script per phase, shown in the phase bar. */
export const PHASE_HINTS: Record<RetroPhase, string> = {
  LOBBY: "Waiting to start. Give people a moment to arrive.",
  CHECK_IN: "A quick pulse before we look at the board.",
  COLLECT: "Write your own cards. You won't see anyone else's until we're done.",
  GROUP: "Drag similar cards together and merge the duplicates.",
  VOTE: "Spend your votes on what's most worth our time.",
  DISCUSS: "Talk through the top cards in turn, and capture what we'll do.",
  ACTIONS: "Agree who owns each action, and by when.",
  CLOSED: "This retrospective is finished.",
};

/**
 * Suggested timer per phase, in seconds. Only the phases where a group
 * genuinely benefits from a box — LOBBY and ACTIONS run as long as they need.
 */
export const PHASE_DEFAULT_TIMER_SECONDS: Partial<Record<RetroPhase, number>> = {
  CHECK_IN: 120,
  COLLECT: 420,
  GROUP: 300,
  VOTE: 180,
};

type FlowOptions = { checkInEnabled: boolean };

/** The phases this particular retro moves through, in order. */
export function phaseSequence(options: FlowOptions): RetroPhase[] {
  return PHASE_ORDER.filter((phase) => phase !== "CHECK_IN" || options.checkInEnabled);
}

export function nextPhase(phase: RetroPhase, options: FlowOptions): RetroPhase | null {
  const sequence = phaseSequence(options);
  const index = sequence.indexOf(phase);
  if (index === -1 || index === sequence.length - 1) return null;
  return sequence[index + 1];
}

export function previousPhase(phase: RetroPhase, options: FlowOptions): RetroPhase | null {
  const sequence = phaseSequence(options);
  const index = sequence.indexOf(phase);
  if (index <= 0) return null;
  return sequence[index - 1];
}

/**
 * May this capability be used right now?
 *
 * An ungated retro — one from before the phase engine, or one a facilitator
 * deliberately runs freeform — behaves exactly as the tool did before phases
 * existed: everything is always available.
 */
export function canInPhase(
  capability: RetroCapability,
  retro: { phase: RetroPhase; isGuided: boolean },
): boolean {
  if (!retro.isGuided) return true;
  return PHASE_CAPABILITIES[retro.phase].includes(capability);
}

export type StepStatus = "complete" | "active" | "upcoming";

/** Maps the flow onto @platned/ui's Stepper, which takes `{ label, status }`. */
export function toStepperSteps(
  current: RetroPhase,
  options: FlowOptions,
): { label: string; status: StepStatus }[] {
  const sequence = phaseSequence(options);
  const currentIndex = sequence.indexOf(current);

  return sequence.map((phase, index) => ({
    label: PHASE_LABELS[phase],
    status: index < currentIndex ? "complete" : index === currentIndex ? "active" : "upcoming",
  }));
}
