import "server-only";

import type { ActionItemStatus, HealthDimension } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireProjectMember } from "@/lib/authz";
import { RATED_STATUSES, UNRESOLVED_STATUSES } from "@/lib/actionItems";
import { HEALTH_DIMENSIONS, canShowAverages } from "@/lib/health";
import { extractThemes, type Theme } from "@/lib/insights/themes";

/**
 * Cross-retro insights for one project.
 *
 * Every metric is an indexed groupBy on `retrospectiveId`, which is the whole
 * reason that column was denormalised onto RetroCard and CardVote: Prisma's
 * groupBy cannot group by a relation field, so without it each of these would
 * be raw SQL or an N+1.
 *
 * Tenant scoping runs one way only. The first query resolves `retroIds` from
 * the authorized `projectId`; every later query filters on that list. No
 * client-supplied retro id reaches an aggregate.
 */

export type RetroSummary = {
  id: string;
  title: string;
  createdAt: Date;
  status: string;
  participantCount: number;
  cardCount: number;
  voteCount: number;
  /** -1 (all negative) to +1 (all positive); null when no column has a sentiment. */
  sentimentScore: number | null;
};

export type HealthTrendPoint = { retroId: string; createdAt: Date; average: number };

export type HealthTrend = { dimension: HealthDimension; points: HealthTrendPoint[] };

export type HealthInsights = {
  trends: HealthTrend[];
  /**
   * Retros that ran a check-in but had too few answers to report. Counted so
   * the chart can say so: a series that silently skips points, drawn as a
   * smooth line, is a lie about what was measured.
   */
  suppressedRetros: number;
};

export type ProjectInsights = {
  retros: RetroSummary[];
  memberCount: number;
  actionsByStatus: Record<ActionItemStatus, number>;
  /** DONE as a share of everything except DROPPED; null when there is nothing to rate. */
  completionRate: number | null;
  medianDaysToClose: number | null;
  carriedOverCount: number;
  /** Items still outstanding that have been carried at least once. */
  stalledCount: number;
  themes: Theme[];
  health: HealthInsights;
};

const EMPTY_STATUS_COUNTS: Record<ActionItemStatus, number> = {
  OPEN: 0,
  IN_PROGRESS: 0,
  BLOCKED: 0,
  DONE: 0,
  DROPPED: 0,
};

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

export async function getProjectInsights(input: {
  projectId: string;
  limit?: number;
}): Promise<ProjectInsights> {
  await requireProjectMember(input.projectId);
  const limit = Math.min(Math.max(input.limit ?? 12, 1), 50);

  // Newest first for the query, oldest first for display — a trend reads left
  // to right.
  const recent = await prisma.retrospective.findMany({
    where: { projectId: input.projectId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { id: true, title: true, createdAt: true, status: true },
  });
  const retros = [...recent].reverse();
  const retroIds = retros.map((r) => r.id);

  if (retroIds.length === 0) {
    return {
      retros: [],
      memberCount: 0,
      actionsByStatus: { ...EMPTY_STATUS_COUNTS },
      completionRate: null,
      medianDaysToClose: null,
      carriedOverCount: 0,
      stalledCount: 0,
      themes: [],
      health: { trends: [], suppressedRetros: 0 },
    };
  }

  const inScope = { retrospectiveId: { in: retroIds } };

  const [
    memberCount,
    participation,
    cardsPerRetro,
    cardsPerColumn,
    columns,
    votesPerRetro,
    actionCounts,
    closed,
    carriedOverCount,
    stalledCount,
    themeCards,
    checkInCounts,
    healthAverages,
  ] = await Promise.all([
    prisma.projectMembership.count({ where: { projectId: input.projectId } }),
    prisma.retroParticipant.groupBy({ by: ["retrospectiveId"], where: inScope, _count: { _all: true } }),
    prisma.retroCard.groupBy({ by: ["retrospectiveId"], where: inScope, _count: { _all: true } }),
    prisma.retroCard.groupBy({
      by: ["retrospectiveId", "columnId"],
      where: inScope,
      _count: { _all: true },
    }),
    prisma.retroColumn.findMany({
      where: inScope,
      select: { id: true, retrospectiveId: true, sentiment: true },
    }),
    prisma.cardVote.groupBy({ by: ["retrospectiveId"], where: inScope, _count: { _all: true } }),
    prisma.actionItem.groupBy({ by: ["status"], where: inScope, _count: { _all: true } }),
    prisma.actionItem.findMany({
      where: { ...inScope, status: "DONE", completedAt: { not: null } },
      select: { createdAt: true, completedAt: true },
    }),
    prisma.retroCarryOver.count({ where: inScope }),
    prisma.actionItem.count({
      where: {
        ...inScope,
        status: { in: [...UNRESOLVED_STATUSES] },
        carryOvers: { some: {} },
      },
    }),
    // The only non-aggregate read, deliberately bounded. No authorId is
    // selected, so nothing here can attribute a card on an anonymous board.
    prisma.retroCard.findMany({
      where: inScope,
      select: { id: true, retrospectiveId: true, content: true },
      take: 2000,
    }),
    // How many people answered each retro's check-in. The averages below are
    // computed for every retro; which of them may be *returned* is decided from
    // this count, per retro, using the same threshold the board applies.
    prisma.healthCheckIn.groupBy({
      by: ["retrospectiveId"],
      where: inScope,
      _count: { _all: true },
    }),
    prisma.healthScore.groupBy({
      by: ["retrospectiveId", "dimension"],
      where: inScope,
      _avg: { value: true },
    }),
  ]);

  const participantsById = new Map(participation.map((p) => [p.retrospectiveId, p._count._all]));
  const cardsById = new Map(cardsPerRetro.map((c) => [c.retrospectiveId, c._count._all]));
  const votesById = new Map(votesPerRetro.map((v) => [v.retrospectiveId, v._count._all]));
  const sentimentByColumn = new Map(columns.map((c) => [c.id, c.sentiment]));

  // (positive - negative) / (positive + negative). NEUTRAL columns are left out
  // of both halves rather than counted as zero, so a board of mostly neutral
  // columns doesn't have its score dragged towards the middle.
  const sentimentTallies = new Map<string, { positive: number; negative: number }>();
  for (const row of cardsPerColumn) {
    const sentiment = sentimentByColumn.get(row.columnId);
    if (sentiment !== "POSITIVE" && sentiment !== "NEGATIVE") continue;
    const tally = sentimentTallies.get(row.retrospectiveId) ?? { positive: 0, negative: 0 };
    if (sentiment === "POSITIVE") tally.positive += row._count._all;
    else tally.negative += row._count._all;
    sentimentTallies.set(row.retrospectiveId, tally);
  }

  const actionsByStatus = { ...EMPTY_STATUS_COUNTS };
  for (const row of actionCounts) actionsByStatus[row.status] = row._count._all;

  const rated = RATED_STATUSES.reduce((total, status) => total + actionsByStatus[status], 0);
  const completionRate = rated === 0 ? null : actionsByStatus.DONE / rated;

  /**
   * The mood trend, with the k-anonymity threshold applied per retrospective.
   *
   * A retro with two answers is dropped from the series rather than plotted or
   * interpolated: aggregating across retros would otherwise be a way around a
   * threshold that the board itself enforces. Dropping leaves the x-axis
   * unevenly spaced, which the chart's caption has to admit to.
   */
  const submissionsByRetro = new Map(checkInCounts.map((row) => [row.retrospectiveId, row._count._all]));
  const reportable = new Set(
    [...submissionsByRetro.entries()].filter(([, count]) => canShowAverages(count)).map(([id]) => id),
  );
  const suppressedRetros = submissionsByRetro.size - reportable.size;

  const healthByDimension = new Map<HealthDimension, HealthTrendPoint[]>();
  const retroById = new Map(retros.map((r) => [r.id, r]));
  for (const row of healthAverages) {
    if (!reportable.has(row.retrospectiveId)) continue;
    const retro = retroById.get(row.retrospectiveId);
    if (!retro || row._avg.value === null) continue;
    const points = healthByDimension.get(row.dimension) ?? [];
    points.push({ retroId: retro.id, createdAt: retro.createdAt, average: row._avg.value });
    healthByDimension.set(row.dimension, points);
  }

  const daysToClose = closed
    .filter((item) => item.completedAt !== null)
    .map((item) => (item.completedAt!.getTime() - item.createdAt.getTime()) / 86_400_000);

  return {
    retros: retros.map((retro) => {
      const tally = sentimentTallies.get(retro.id);
      const total = (tally?.positive ?? 0) + (tally?.negative ?? 0);
      return {
        id: retro.id,
        title: retro.title,
        createdAt: retro.createdAt,
        status: retro.status,
        participantCount: participantsById.get(retro.id) ?? 0,
        cardCount: cardsById.get(retro.id) ?? 0,
        voteCount: votesById.get(retro.id) ?? 0,
        sentimentScore: total === 0 ? null : ((tally?.positive ?? 0) - (tally?.negative ?? 0)) / total,
      };
    }),
    memberCount,
    actionsByStatus,
    completionRate,
    medianDaysToClose: median(daysToClose),
    carriedOverCount,
    stalledCount,
    themes: extractThemes(themeCards),
    health: {
      // Canonical dimension order, oldest point first — the same left-to-right
      // reading as every other series on the page.
      trends: HEALTH_DIMENSIONS.filter((dimension) => healthByDimension.has(dimension)).map(
        (dimension) => ({
          dimension,
          points: (healthByDimension.get(dimension) ?? []).sort(
            (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
          ),
        }),
      ),
      suppressedRetros,
    },
  };
}
