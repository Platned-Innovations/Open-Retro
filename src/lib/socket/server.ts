import type { Server as IOServer } from "socket.io";

/**
 * Single Socket.IO server instance shared between the custom HTTP server
 * (server.ts, which creates it) and server actions / route handlers (which
 * emit through it). Next.js runs server actions in the same Node process as
 * server.ts, so a plain module-level singleton is enough for a single
 * instance deployment.
 */
const globalForIO = globalThis as unknown as { io: IOServer | undefined };

export function setIO(io: IOServer) {
  globalForIO.io = io;
}

export function getIO(): IOServer | undefined {
  return globalForIO.io;
}

export function retroRoom(retrospectiveId: string) {
  return `retro:${retrospectiveId}`;
}
