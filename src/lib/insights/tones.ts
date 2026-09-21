import type { ActionItemStatus } from "@/generated/prisma/client";

/**
 * Chart colours for action-item statuses, mapped once — the dataviz skill's
 * reserved status palette (good/warning/serious), since this is a genuine
 * state breakdown, not generic categorical data.
 *
 * DROPPED shares neutral with OPEN rather than getting a colour of its own: it
 * is excluded from the completion rate, and giving it a distinct shade would
 * imply it counts for something in the chart it sits in.
 */
export const ACTION_STATUS_CHART_COLOR: Record<ActionItemStatus, string> = {
  OPEN: "#c3c2b7", // neutral
  IN_PROGRESS: "#2a78d6", // categorical blue, doubles as "in motion"
  BLOCKED: "#ec835a", // serious
  DONE: "#0ca30c", // good
  DROPPED: "#c3c2b7", // neutral
};
