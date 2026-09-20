"use client";

import { DropdownMenu, StatusBadge, type DropdownMenuItem } from "@platned/ui";
import { setActionItemStatus } from "@/server/actions/retros";
import {
  ACTION_STATUS_LABELS,
  ACTION_STATUS_ORDER,
  ACTION_STATUS_TONE,
} from "@/lib/actionItems";
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

  const items: DropdownMenuItem[] = ACTION_STATUS_ORDER.map((next) => ({
    label: ACTION_STATUS_LABELS[next],
    disabled: next === status,
    onSelect: () => run(() => setActionItemStatus({ retrospectiveId, actionItemId, status: next })),
  }));

  return (
    <DropdownMenu
      items={items}
      align="right"
      label={`Change status of "${description.slice(0, 40)}"`}
      trigger={
        <StatusBadge label={ACTION_STATUS_LABELS[status]} tone={ACTION_STATUS_TONE[status]} size="sm" />
      }
    />
  );
}
