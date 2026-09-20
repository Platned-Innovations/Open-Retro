"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import {
  RETRO_SOCKET_EVENTS,
  URGENT_RETRO_EVENTS,

  type RetroSocketMessage,
} from "@/lib/socket/events";

export type PresenceUser = { userId: string; name: string };
export type CursorPosition = { userId: string; name: string; x: number; y: number; updatedAt: number };

const CURSOR_EMIT_INTERVAL_MS = 60;
const CURSOR_EXPIRE_MS = 8000;

/**
 * How long to gather events before re-reading the board.
 *
 * Every event used to trigger its own full refetch of `getRetroBoard`, which
 * loads the entire board. In a live retro that meant roughly N participants ×
 * N actions full-tree refetches: ten people typing cards produced a refetch
 * storm against the most expensive query in the app. Collecting a burst into
 * one read costs a fraction of a second of staleness and removes the storm.
 */
const REFRESH_DEBOUNCE_MS = 150;

/**
 * Joins the room for one retrospective: re-reads board data when something
 * changes, and tracks who else is viewing plus their live pointer position
 * (Google-Docs-style presence).
 */
export function useRetroSocket(
  retrospectiveId: string,
  onBoardEvent: (message: RetroSocketMessage) => void,
) {
  const onEventRef = useRef(onBoardEvent);
  useEffect(() => {
    onEventRef.current = onBoardEvent;
  }, [onBoardEvent]);

  const socketRef = useRef<Socket | null>(null);
  const lastCursorEmitRef = useRef(0);
  const [viewers, setViewers] = useState<PresenceUser[]>([]);
  const [cursors, setCursors] = useState<Record<string, CursorPosition>>({});

  useEffect(() => {
    const socket: Socket = io({ path: "/socket.io", withCredentials: true });
    socketRef.current = socket;

    socket.on("connect", () => socket.emit("retro:join", retrospectiveId));

    let debounceTimer: ReturnType<typeof setTimeout> | undefined;
    let pending: RetroSocketMessage | undefined;

    for (const event of RETRO_SOCKET_EVENTS) {
      // socket.io hands back an untyped frame; the pairing is reconstructed
      // here, once, rather than at every consumer.
      socket.on(event, (payload: unknown) => {
        const message = { event, payload } as RetroSocketMessage;
        // Status changes and timer starts/stops decide what the viewer is
        // allowed to do, so they skip the queue — waiting would leave the board
        // briefly accepting input it is about to refuse.
        if (URGENT_RETRO_EVENTS.includes(event)) {
          clearTimeout(debounceTimer);
          debounceTimer = undefined;
          pending = undefined;
          onEventRef.current(message);
          return;
        }

        pending = message;
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          debounceTimer = undefined;
          if (pending) onEventRef.current(pending);
          pending = undefined;
        }, REFRESH_DEBOUNCE_MS);
      });
    }

    socket.on("presence:update", (list: PresenceUser[]) => {
      setViewers(list);
      const stillHere = new Set(list.map((v) => v.userId));
      setCursors((prev) => {
        const next: Record<string, CursorPosition> = {};
        for (const [id, pos] of Object.entries(prev)) {
          if (stillHere.has(id)) next[id] = pos;
        }
        return next;
      });
    });

    socket.on("cursor:move", (pos: { userId: string; name: string; x: number; y: number }) => {
      setCursors((prev) => ({ ...prev, [pos.userId]: { ...pos, updatedAt: Date.now() } }));
    });

    return () => {
      clearTimeout(debounceTimer);
      socket.emit("retro:leave", retrospectiveId);
      socket.disconnect();
      setViewers([]);
      setCursors({});
    };
  }, [retrospectiveId]);

  // Prune cursors that went quiet without a clean presence update (closed
  // laptop lid, network drop, etc.) so a stale pointer doesn't linger forever.
  useEffect(() => {
    const interval = setInterval(() => {
      setCursors((prev) => {
        const now = Date.now();
        const next: Record<string, CursorPosition> = {};
        let changed = false;
        for (const [id, pos] of Object.entries(prev)) {
          if (now - pos.updatedAt < CURSOR_EXPIRE_MS) next[id] = pos;
          else changed = true;
        }
        return changed ? next : prev;
      });
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const emitCursor = useCallback(
    (x: number, y: number) => {
      const now = Date.now();
      if (now - lastCursorEmitRef.current < CURSOR_EMIT_INTERVAL_MS) return;
      lastCursorEmitRef.current = now;
      socketRef.current?.emit("cursor:move", { retrospectiveId, x, y });
    },
    [retrospectiveId],
  );

  return { viewers, cursors, emitCursor };
}
