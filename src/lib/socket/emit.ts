import "server-only";
import { getIO, retroRoom } from "@/lib/socket/server";
import type { RetroSocketEvent, RetroSocketPayloads } from "@/lib/socket/events";

/**
 * Tell everyone viewing a retro that something changed, so they re-read the
 * board. No-ops safely if the Socket.IO server hasn't been set up yet (e.g.
 * plain `next dev` before the custom server is wired in) so board mutations
 * still work via the normal Next.js revalidate-on-navigation path.
 *
 * Generic over the payload map, so a model row will not type-check — see the
 * note in ./events.ts for why that matters.
 */
export function broadcastToRetro<E extends RetroSocketEvent>(
  retrospectiveId: string,
  event: E,
  payload: RetroSocketPayloads[E],
) {
  const io = getIO();
  if (!io) return;
  io.to(retroRoom(retrospectiveId)).emit(event, payload);
}
