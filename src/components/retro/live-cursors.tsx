"use client";

import { colorForUser, textColorOn } from "@/lib/userColor";
import type { CursorPosition } from "@/lib/socket/useRetroSocket";

/**
 * Absolutely-positioned overlay for teammates' live pointers, positioned as
 * a percentage of the board container (see the `onMouseMove` handler on
 * that container). An approximation, not a synced viewport — if someone has
 * scrolled the board differently, their cursor will land slightly off, but
 * it's close enough to convey "someone's over there right now."
 */
export function LiveCursors({ cursors }: { cursors: Record<string, CursorPosition> }) {
  const list = Object.values(cursors);
  if (list.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-40 overflow-hidden">
      {list.map((cursor) => {
        const color = colorForUser(cursor.userId);
        return (
          <div
            key={cursor.userId}
            className="absolute transition-[left,top] duration-150 ease-out"
            style={{ left: `${cursor.x}%`, top: `${cursor.y}%` }}
          >
            <svg width="16" height="18" viewBox="0 0 16 18" fill="none">
              <path
                d="M1 1L14.5 7.5L8.5 9L6 15.5L1 1Z"
                fill={color}
                stroke="white"
                strokeWidth="1"
              />
            </svg>
            <span
              className="ml-3.5 -mt-1 inline-block whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-medium shadow"
              style={{ backgroundColor: color, color: textColorOn(color) }}
            >
              {cursor.name}
            </span>
          </div>
        );
      })}
    </div>
  );
}
