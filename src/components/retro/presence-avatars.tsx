"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { colorForUser, textColorOn } from "@/lib/userColor";
import type { PresenceUser } from "@/lib/socket/useRetroSocket";

const MAX_SHOWN = 5;

/**
 * Deliberately not @platned/ui's <Avatar> — presence needs a per-user colour
 * computed at runtime (colorForUser), which the design system's avatar has
 * no prop for (its "initial" variant hardcodes a fixed brand gradient). This
 * mirrors the library's own documented escape hatch for genuinely
 * data-driven colour (see StatusDot/TagPill's deprecated `color` props).
 */
export function PresenceAvatars({
  viewers,
  currentUserId,
}: {
  viewers: PresenceUser[];
  currentUserId: string;
}) {
  if (viewers.length === 0) return null;

  const shown = viewers.slice(0, MAX_SHOWN);
  const extra = viewers.length - shown.length;

  return (
    <div className="flex items-center -space-x-2">
      {shown.map((viewer) => {
        const background = colorForUser(viewer.userId);
        const label = `${viewer.name}${viewer.userId === currentUserId ? " (you)" : ""}`;
        return (
          <Tooltip key={viewer.userId}>
            {/* A button, not a span: the trigger was unfocusable, so the only
                way to find out who was on the board was to hover — which no
                keyboard or touch user can do. */}
            <TooltipTrigger render={<button type="button" aria-label={label} />}>
              <span
                aria-hidden
                className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-default text-body-tiny font-semibold"
                style={{ backgroundColor: background, color: textColorOn(background) }}
              >
                {viewer.name.slice(0, 2).toUpperCase()}
              </span>
            </TooltipTrigger>
            <TooltipContent>{label}</TooltipContent>
          </Tooltip>
        );
      })}
      {extra > 0 && (
        <span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-default bg-default-secondary text-body-tiny font-medium text-default">
          +{extra}
        </span>
      )}
    </div>
  );
}
