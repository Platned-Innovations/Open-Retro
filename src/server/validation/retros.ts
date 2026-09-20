import "server-only";
import { z } from "zod";
import {
  ActionItemStatus,
  HealthDimension,
  RetroPhase,
  RetroTemplate,
  RetroStatus,
} from "@/generated/prisma/enums";
import { HEALTH_DIMENSIONS, HEALTH_SCALE_MAX, HEALTH_SCALE_MIN } from "@/lib/health";
import {
  cardContent,
  description,
  id,
  idList,
  orderIndex,
  reactionEmoji,
  timerSeconds,
  title,
} from "@/server/validation/common";

/**
 * Enum validators are derived from the Prisma-generated runtime objects rather
 * than hand-copied, so they cannot drift from schema.prisma.
 */
export const createRetrospectiveInput = z
  .object({
    projectId: id,
    title,
    template: z.enum(RetroTemplate),
    // A retro with thousands of columns is unrenderable, and each one is a row
    // written inside a single transaction.
    customColumns: z.array(title).max(12).optional(),
    isAnonymous: z.boolean().optional(),
    isGuided: z.boolean().optional(),
    voteBudget: z.number().int().min(0).max(50).optional(),
    hideOthersCards: z.boolean().optional(),
  })
  .refine(
    (value) => value.template !== "CUSTOM" || (value.customColumns?.length ?? 0) > 0,
    "A custom retrospective needs at least one column",
  );

export const setRetroStatusInput = z.object({
  retrospectiveId: id,
  status: z.enum(RetroStatus).exclude(["DRAFT"]),
});

export const startTimerInput = z.object({
  retrospectiveId: id,
  seconds: timerSeconds,
});

export const createCardInput = z.object({
  retrospectiveId: id,
  columnId: id,
  content: cardContent,
});

export const updateCardInput = z.object({
  retrospectiveId: id,
  cardId: id,
  content: cardContent,
});

export const moveCardInput = z.object({
  retrospectiveId: id,
  cardId: id,
  toColumnId: id,
  toIndex: orderIndex,
});

export const groupCardsInput = z.object({
  retrospectiveId: id,
  cardId: id,
  ontoCardId: id,
});

export const toggleReactionInput = z.object({
  retrospectiveId: id,
  cardId: id,
  emoji: reactionEmoji,
});

export const addCommentInput = z.object({
  retrospectiveId: id,
  cardId: id.optional(),
  actionItemId: id.optional(),
  content: cardContent,
});

export const createActionItemInput = z.object({
  retrospectiveId: id,
  description,
  assigneeIds: idList(50).optional(),
  dueDate: z.date().optional(),
  sourceCardId: id.optional(),
});

export const updateActionItemInput = z.object({
  retrospectiveId: id,
  actionItemId: id,
  description: description.optional(),
  dueDate: z.date().nullable().optional(),
});

export const setActionItemStatusInput = z.object({
  retrospectiveId: id,
  actionItemId: id,
  status: z.enum(ActionItemStatus),
});

export const carryOverInput = z.object({
  retrospectiveId: id,
  // Capped for the same reason as every other list: one call should not be able
  // to drag a project's entire history onto a board.
  actionItemIds: idList(50).min(1, "Pick at least one action item"),
});

export const updateActionItemAssigneesInput = z.object({
  retrospectiveId: id,
  actionItemId: id,
  assigneeIds: idList(50),
});

export const setRetroPhaseInput = z.object({
  retrospectiveId: id,
  to: z.enum(RetroPhase),
  /** The phase the caller believed the retro was in — see setRetroPhase. */
  from: z.enum(RetroPhase),
});

export const configureRetroFlowInput = z
  .object({
    retrospectiveId: id,
    isGuided: z.boolean().optional(),
    // 0 is "unlimited", which is what every pre-engine retro had.
    voteBudget: z.number().int().min(0).max(50).optional(),
    hideOthersCards: z.boolean().optional(),
    hideVoteCounts: z.boolean().optional(),
    checkInEnabled: z.boolean().optional(),
    discussSeconds: z.number().int().min(30).max(3600).optional(),
  })
  .refine(
    (value) => Object.keys(value).length > 1,
    "Nothing to change",
  );

export const transferFacilitationInput = z.object({
  retrospectiveId: id,
  toUserId: id,
});

export const setDiscussionCardInput = z.object({
  retrospectiveId: id,
  cardId: id.nullable(),
});

/**
 * Every dimension, exactly once.
 *
 * Partial submissions are refused rather than accepted, because a per-dimension
 * denominator would mean the k-anonymity threshold has to hold per dimension
 * too — five submissions where only two people answered WORKLOAD would publish
 * a two-person average. Requiring the full set keeps `submitted` a single
 * honest denominator. The scale has a neutral middle for "no strong view".
 */
export const submitHealthCheckInInput = z.object({
  retrospectiveId: id,
  scores: z
    .array(
      z.object({
        dimension: z.enum(HealthDimension),
        value: z.number().int().min(HEALTH_SCALE_MIN).max(HEALTH_SCALE_MAX),
      }),
    )
    .refine(
      (scores) =>
        scores.length === HEALTH_DIMENSIONS.length &&
        new Set(scores.map((s) => s.dimension)).size === HEALTH_DIMENSIONS.length,
      "Answer every question once",
    ),
});

/** Actions that take nothing but the retro id plus one child id. */
export const retroChildInput = z.object({
  retrospectiveId: id,
  childId: id,
});

export const retroOnlyInput = z.object({ retrospectiveId: id });
