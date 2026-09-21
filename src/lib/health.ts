import type { HealthDimension } from "@/generated/prisma/client";

/**
 * The team health check-in, as both halves of the app understand it.
 *
 * Pure and shared, like retroPhases.ts: the server enforces the scale and the
 * thresholds, and the components render the same table. Two copies of "what
 * does a 2 mean" is how a trend line stops meaning anything.
 */

export const HEALTH_DIMENSIONS = [
  "MORALE",
  "DELIVERY",
  "COLLABORATION",
  "CLARITY",
  "WORKLOAD",
] as const satisfies readonly HealthDimension[];

export const HEALTH_SCALE_MIN = 1;
export const HEALTH_SCALE_MAX = 5;

/**
 * How many people must have answered before anyone sees a number.
 *
 * This, not the HMAC keying, is the protection that does the real work. In a
 * team of three, "the average morale is 1.7" tells you almost exactly what
 * each person said, however anonymously the rows were stored — and a
 * distribution of [0,0,1,1,1] alongside a colleague everyone knows is having a
 * hard month is not anonymous at all.
 *
 * Distributions need a higher bar than averages because they leak shape as
 * well as centre: five answers can hide an outlier, three cannot.
 */
export const MIN_SUBMISSIONS_FOR_AVERAGE = 3;
export const MIN_SUBMISSIONS_FOR_DISTRIBUTION = 5;

export const HEALTH_DIMENSION_LABELS: Record<HealthDimension, string> = {
  MORALE: "Morale",
  DELIVERY: "Delivery",
  COLLABORATION: "Collaboration",
  CLARITY: "Clarity",
  WORKLOAD: "Workload",
};

/**
 * The question each dimension actually asks.
 *
 * Written in the first person and about the last sprint specifically. "Rate
 * collaboration" invites a rating of the abstract idea; "how well did we work
 * together" is answerable from what just happened.
 */
export const HEALTH_DIMENSION_PROMPTS: Record<HealthDimension, string> = {
  MORALE: "How did the last sprint feel?",
  DELIVERY: "Did we finish what we set out to finish?",
  COLLABORATION: "How well did we work together?",
  CLARITY: "Did you know what you were meant to be doing, and why?",
  WORKLOAD: "Was the amount of work sustainable?",
};

/**
 * Anchors for the ends of each scale.
 *
 * Unlabelled 1-5 scales measure how generous someone is feeling. Naming both
 * ends in the dimension's own terms is what makes one person's 4 comparable to
 * another's — and it is why WORKLOAD reads "crushing → sustainable" rather
 * than "low → high", which would leave it genuinely ambiguous whether 5 is
 * good news.
 */
export const HEALTH_SCALE_ANCHORS: Record<HealthDimension, { low: string; high: string }> = {
  MORALE: { low: "Rough", high: "Great" },
  DELIVERY: { low: "Fell short", high: "Delivered" },
  COLLABORATION: { low: "Siloed", high: "In step" },
  CLARITY: { low: "In the dark", high: "Crystal clear" },
  WORKLOAD: { low: "Crushing", high: "Sustainable" },
};

/** Every dimension runs low-is-bad, which is what lets one tone scale serve all five. */
export function healthTone(average: number): "danger" | "warning" | "positive" {
  if (average < 2.5) return "danger";
  if (average < 3.5) return "warning";
  return "positive";
}

/**
 * Chart color for each tone — the dataviz skill's reserved status palette,
 * since a health average is a genuine state indicator, not categorical data.
 */
export const HEALTH_TONE_COLOR: Record<ReturnType<typeof healthTone>, string> = {
  positive: "#0ca30c",
  warning: "#fab219",
  danger: "#d03b3b",
};

/**
 * Whether a summary may show anything at all.
 *
 * Exported so the check-in form can tell people the truth *before* they answer
 * — "results appear once 3 people have" — rather than after.
 */
export function canShowAverages(submitted: number): boolean {
  return submitted >= MIN_SUBMISSIONS_FOR_AVERAGE;
}

export function canShowDistribution(submitted: number): boolean {
  return submitted >= MIN_SUBMISSIONS_FOR_DISTRIBUTION;
}

/** Why a summary is withheld, in words a participant can act on. */
export function suppressionReason(submitted: number): string | null {
  if (canShowAverages(submitted)) return null;
  const needed = MIN_SUBMISSIONS_FOR_AVERAGE - submitted;
  return submitted === 0
    ? `Results appear once ${MIN_SUBMISSIONS_FOR_AVERAGE} people have checked in.`
    : `${submitted} ${submitted === 1 ? "person has" : "people have"} checked in. ` +
        `${needed} more ${needed === 1 ? "answer keeps" : "answers keep"} this anonymous.`;
}
