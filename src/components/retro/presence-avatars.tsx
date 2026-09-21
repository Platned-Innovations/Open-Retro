"use client";

import Tooltip from "@mui/material/Tooltip";
import AvatarGroup from "@mui/material/AvatarGroup";
import Avatar from "@mui/material/Avatar";
import { colorForUser, textColorOn } from "@/lib/userColor";
import type { PresenceUser } from "@/lib/socket/useRetroSocket";

const MAX_SHOWN = 5;

/**
 * Per-user colour computed at runtime (`colorForUser`), so this stays a plain
 * MUI `Avatar` rather than anything that hardcodes a palette — `AvatarGroup`
 * gives the overflow "+N" for free.
 */
export function PresenceAvatars({ viewers, currentUserId }: { viewers: PresenceUser[]; currentUserId: string }) {
  if (viewers.length === 0) return null;

  return (
    <AvatarGroup max={MAX_SHOWN} sx={{ "& .MuiAvatar-root": { width: 28, height: 28, fontSize: 12 } }}>
      {viewers.map((viewer) => {
        const background = colorForUser(viewer.userId);
        const label = `${viewer.name}${viewer.userId === currentUserId ? " (you)" : ""}`;
        return (
          <Tooltip key={viewer.userId} title={label}>
            <Avatar sx={{ bgcolor: background, color: textColorOn(background) }}>{viewer.name.slice(0, 2).toUpperCase()}</Avatar>
          </Tooltip>
        );
      })}
    </AvatarGroup>
  );
}
