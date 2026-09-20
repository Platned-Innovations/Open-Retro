import type { RetroPhase } from "@/generated/prisma/client";

/**
 * The board events broadcast to everyone viewing a retrospective.
 *
 * One list, imported by both the server emitter and the client hook, so the two
 * cannot drift — they were previously maintained separately, which is how
 * `retro:deleted` came to be broadcast with nobody listening for it.
 *
 * **Payloads are ids and scalars only, never model rows.** Broadcasts used to
 * ship whole Prisma objects — card content, author ids, full User records —
 * to every socket in the room, including on retros marked anonymous. The
 * payload type below is the guardrail: every subscriber still re-reads the
 * board through `getRetroBoard`, which is the only place authorization and
 * anonymity redaction live, so a payload exists to say *what changed*, never to
 * carry the change itself.
 */
export type RetroSocketPayloads = {
  "card:create": { columnId: string };
  "card:update": { cardId: string };
  "card:delete": { cardId: string };
  "card:move": { cardId: string; toColumnId: string };
  /** No userId: who voted is exactly what an anonymous board must not reveal. */
  "vote:toggle": { cardId: string };
  "reaction:toggle": { cardId: string };
  "comment:create": { cardId: string | null };
  "actionItem:create": { actionItemId: string };
  "actionItem:update": { actionItemId: string };
  "actionItem:delete": { actionItemId: string };
  "retro:statusChange": Record<string, never>;
  "retro:deleted": Record<string, never>;
  /** ISO string, not a Date — socket frames are JSON, not structured clone. */
  "timer:start": { timerEndsAt: string };
  "timer:stop": Record<string, never>;
  /** The one payload the client actually reads, to announce the new step. */
  "phase:change": { phase: RetroPhase };
  "discuss:change": { cardId: string | null };
  "carryOver:change": Record<string, never>;
  /**
   * Counts only, and deliberately so: "7 of 10" is the most a check-in can
   * announce without telling the room who has and hasn't answered.
   */
  "health:submitted": { submitted: number; expected: number };
};

export type RetroSocketEvent = keyof RetroSocketPayloads;

/**
 * One event and its payload, as a discriminated union.
 *
 * A generic `(event: E, payload: Payloads[E])` signature looks equivalent but
 * doesn't narrow: checking `event === "phase:change"` tells TypeScript nothing
 * about `payload`. Pairing them in a single value is what makes the payload
 * usable at the call site without a cast.
 */
export type RetroSocketMessage = {
  [E in RetroSocketEvent]: { event: E; payload: RetroSocketPayloads[E] };
}[RetroSocketEvent];

export const RETRO_SOCKET_EVENTS = [
  "card:create",
  "card:update",
  "card:delete",
  "card:move",
  "vote:toggle",
  "reaction:toggle",
  "comment:create",
  "actionItem:create",
  "actionItem:update",
  "actionItem:delete",
  "retro:statusChange",
  "retro:deleted",
  "timer:start",
  "timer:stop",
  "phase:change",
  "discuss:change",
  "carryOver:change",
  "health:submitted",
] as const satisfies readonly RetroSocketEvent[];

/**
 * Events that change what the viewer can interact with, rather than just what
 * is on the board. These bypass the refresh debounce so the UI locks or
 * unlocks immediately instead of up to a moment later.
 */
export const URGENT_RETRO_EVENTS: readonly RetroSocketEvent[] = [
  "retro:statusChange",
  "retro:deleted",
  "timer:start",
  "timer:stop",
  "phase:change",
  "discuss:change",
];
