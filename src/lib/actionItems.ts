import type { ChipProps } from "@mui/material/Chip";
import type { ActionItemStatus } from "@/generated/prisma/client";

/**
 * What "still outstanding" means, in one place.
 *
 * Every count, filter and completion rate reads this. Spelling the list out at
 * each call site is how "pending" ends up meaning three slightly different
 * things across the app.
 */
export const UNRESOLVED_STATUSES = ["OPEN", "IN_PROGRESS", "BLOCKED"] as const;

/**
 * Statuses that count towards the completion rate.
 *
 * DROPPED is excluded on purpose: deciding not to do something is a legitimate
 * outcome of a retrospective, and counting it as a failure would punish teams
 * for being honest about what they are not going to do.
 */
export const RATED_STATUSES = ["OPEN", "IN_PROGRESS", "BLOCKED", "DONE"] as const;

export const ACTION_STATUS_LABELS: Record<ActionItemStatus, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In progress",
  BLOCKED: "Blocked",
  DONE: "Done",
  DROPPED: "Dropped",
};

export const ACTION_STATUS_CHIP_COLOR: Record<ActionItemStatus, ChipProps["color"]> = {
  OPEN: "default",
  IN_PROGRESS: "info",
  BLOCKED: "warning",
  DONE: "success",
  DROPPED: "default",
};

export const ACTION_STATUS_ORDER: ActionItemStatus[] = [
  "OPEN",
  "IN_PROGRESS",
  "BLOCKED",
  "DONE",
  "DROPPED",
];

export function isUnresolved(status: ActionItemStatus): boolean {
  return (UNRESOLVED_STATUSES as readonly ActionItemStatus[]).includes(status);
}

/**
 * Past its due date and still outstanding.
 *
 * A resolved item is never overdue, however late it was finished — flagging
 * completed work in red tells nobody anything they can act on.
 */
export function isOverdue(item: { dueDate: Date | null; status: ActionItemStatus }): boolean {
  if (!item.dueDate || !isUnresolved(item.status)) return false;
  return item.dueDate.getTime() < Date.now();
}
