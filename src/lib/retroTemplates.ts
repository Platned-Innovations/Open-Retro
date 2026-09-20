import type { ColumnSentiment, RetroTemplate } from "@/generated/prisma/client";

type TemplateColumn = { title: string; color: string; sentiment: ColumnSentiment };

/**
 * The built-in board layouts.
 *
 * `sentiment` lets the insights view read a board's mood without asking anyone
 * to fill anything in: a retro with twice as many "stop doing" cards as "keep
 * doing" ones is telling you something, and nobody had to score it.
 *
 * Columns that genuinely aren't positive or negative stay NEUTRAL and are left
 * out of the calculation entirely, rather than counted as zero — otherwise a
 * board of mostly neutral columns has its score dragged towards the middle.
 */
export const COLUMN_TEMPLATES: Record<Exclude<RetroTemplate, "CUSTOM">, TemplateColumn[]> = {
  MAD_SAD_GLAD: [
    { title: "Mad", color: "#ef4444", sentiment: "NEGATIVE" },
    { title: "Sad", color: "#6366f1", sentiment: "NEGATIVE" },
    { title: "Glad", color: "#22c55e", sentiment: "POSITIVE" },
  ],
  START_STOP_CONTINUE: [
    { title: "▶️ Start doing", color: "#22c55e", sentiment: "POSITIVE" },
    { title: "🛑 Stop doing", color: "#ef4444", sentiment: "NEGATIVE" },
    { title: "🙌 Keep doing", color: "#3b82f6", sentiment: "POSITIVE" },
  ],
  FOUR_LS: [
    { title: "Liked", color: "#22c55e", sentiment: "POSITIVE" },
    { title: "Learned", color: "#3b82f6", sentiment: "POSITIVE" },
    { title: "Lacked", color: "#f97316", sentiment: "NEGATIVE" },
    { title: "Longed for", color: "#a855f7", sentiment: "NEGATIVE" },
  ],
  WENT_WELL_IMPROVE_ACTIONS: [
    { title: "Went well", color: "#22c55e", sentiment: "POSITIVE" },
    { title: "To improve", color: "#f97316", sentiment: "NEGATIVE" },
    // Neither good news nor bad — it is where a team parks what it hasn't
    // decided about yet.
    { title: "Discuss", color: "#3b82f6", sentiment: "NEUTRAL" },
  ],
};

export const TEMPLATE_LABELS: Record<RetroTemplate, string> = {
  MAD_SAD_GLAD: "Mad / Sad / Glad",
  START_STOP_CONTINUE: "Start doing / Stop doing / Keep doing",
  FOUR_LS: "4Ls (Liked, Learned, Lacked, Longed for)",
  WENT_WELL_IMPROVE_ACTIONS: "Went well / To improve / Discuss",
  CUSTOM: "Custom columns",
};
