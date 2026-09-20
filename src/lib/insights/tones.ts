import type { ActionItemStatus } from "@/generated/prisma/client";

/**
 * Chart colours for action-item statuses, mapped once.
 *
 * `ChartTone` only — never a raw hex. `@platned/ui` marks `color`, `dotColor`
 * and `bg` as deprecated precisely because bypassing the token layer is how two
 * status palettes end up disagreeing about what "blocked" looks like.
 *
 * DROPPED shares neutral with OPEN rather than getting a colour of its own: it
 * is excluded from the completion rate, and giving it a distinct shade would
 * imply it counts for something in the chart it sits in.
 */
export const ACTION_STATUS_CHART_TONE: Record<
  ActionItemStatus,
  "brand" | "info" | "positive" | "warning" | "danger" | "neutral"
> = {
  OPEN: "neutral",
  IN_PROGRESS: "info",
  BLOCKED: "warning",
  DONE: "positive",
  DROPPED: "neutral",
};
