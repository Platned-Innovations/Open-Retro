"use client";

import { useState, type MouseEvent } from "react";
import Chip from "@mui/material/Chip";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import { setActionItemStatus } from "@/server/actions/retros";
import { ACTION_STATUS_LABELS, ACTION_STATUS_ORDER, ACTION_STATUS_CHIP_COLOR } from "@/lib/actionItems";
import { useAction } from "@/lib/useAction";
import type { ActionItemStatus } from "@/generated/prisma/client";

/**
 * The only interactive part of /my-actions.
 *
 * The page itself stays a Server Component — filters run through searchParams —
 * so this is the single client island rather than the whole table.
 */
export function MyActionStatus({
  retrospectiveId,
  actionItemId,
  status,
  description,
}: {
  retrospectiveId: string;
  actionItemId: string;
  status: ActionItemStatus;
  description: string;
}) {
  const { run } = useAction();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  return (
    <>
      <Chip
        label={ACTION_STATUS_LABELS[status]}
        color={ACTION_STATUS_CHIP_COLOR[status]}
        size="small"
        onClick={(e: MouseEvent<HTMLElement>) => setAnchorEl(e.currentTarget)}
        aria-label={`Change status of "${description.slice(0, 40)}"`}
      />
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
        {ACTION_STATUS_ORDER.map((next) => (
          <MenuItem
            key={next}
            disabled={next === status}
            onClick={() => {
              setAnchorEl(null);
              run(() => setActionItemStatus({ retrospectiveId, actionItemId, status: next }));
            }}
          >
            {ACTION_STATUS_LABELS[next]}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
