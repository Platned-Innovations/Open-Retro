import "server-only";

/**
 * The team health check-in.
 *
 * Plain server-only, not `"use server"` — see the note in ./lifecycle.ts.
 *
 * Two rules hold everything else up, and both live here rather than in the UI:
 *
 *  1. A submission is keyed by HMAC-SHA256(userId, retro.healthSalt), never by
 *     userId. Amending your own answer works; attributing anyone's answer does
 *     not, even with database access.
 *  2. Nothing is reported until enough people have answered that the numbers
 *     cannot be read back onto individuals. See src/lib/health.ts.
 */

import { createHmac } from "node:crypto";
import type { HealthDimension } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { ForbiddenError, requireRetroAccess } from "@/lib/authz";
import { requireRetroCapability } from "@/server/retro/guards";
import {
  HEALTH_DIMENSIONS,
  canShowAverages,
  canShowDistribution,
  suppressionReason,
} from "@/lib/health";
import { broadcastToRetro } from "@/lib/socket/emit";
import { revalidatePath } from "next/cache";
import { parse } from "@/server/validation/parse";
import { submitHealthCheckInInput } from "@/server/validation/retros";

/**
 * The salt, read on its own rather than carried in RetroContext.
 *
 * RetroContext is passed to every board mutation and is one careless
 * `console.log` away from a logfile. The salt is the only secret that makes
 * the keying worth anything, so its blast radius stays inside this file.
 */
async function loadSalt(retrospectiveId: string): Promise<string> {
  const retro = await prisma.retrospective.findUniqueOrThrow({
    where: { id: retrospectiveId },
    select: { healthSalt: true },
  });
  return retro.healthSalt;
}

/**
 * The pseudonym one person carries for one retrospective.
 *
 * Per-retro salt, so the same key never appears on two boards: with a single
 * global salt, anyone holding the database could line up "participant 4c9f…"
 * across a year of retros and watch one person's morale decline.
 */
function participantKeyFor(userId: string, salt: string): string {
  return createHmac("sha256", salt).update(userId).digest("hex");
}

export type HealthDimensionSummary = {
  dimension: HealthDimension;
  average: number;
  /** Counts for scores 1-5, or null while below the distribution threshold. */
  distribution: number[] | null;
};

export type HealthSummary = {
  submitted: number;
  /** People who have opened this board — not project members, who may not be here. */
  expected: number;
  /** The viewer's own answers, so the form can be amended rather than redone. */
  mine: { dimension: HealthDimension; value: number }[] | null;
  dimensions: HealthDimensionSummary[];
  /** Non-null means there is deliberately nothing to show yet, and why. */
  suppressedReason: string | null;
};

/**
 * Records — or amends — the viewer's check-in.
 *
 * Re-submitting replaces the previous answers rather than adding a second
 * voice to the average, which is what the (retrospectiveId, participantKey)
 * unique is for.
 */
export async function submitHealthCheckIn(rawInput: {
  retrospectiveId: string;
  scores: { dimension: HealthDimension; value: number }[];
}) {
  const input = parse(submitHealthCheckInInput, rawInput);
  const { user, retro } = await requireRetroCapability(input.retrospectiveId, "submitCheckIn");

  // A board with the check-in switched off must not quietly accumulate one. On
  // an unguided board every capability is permitted, so without this a crafted
  // request would build a summary for a team that opted out.
  if (!retro.checkInEnabled) {
    throw new ForbiddenError("This retrospective isn't running a check-in");
  }

  const salt = await loadSalt(input.retrospectiveId);
  const participantKey = participantKeyFor(user.id, salt);

  // Replace-then-write rather than five upserts: the scores are one answer, and
  // a partial failure part-way through five independent upserts would leave a
  // check-in half amended. Serial inside one transaction is five small writes.
  await prisma.$transaction(async (tx) => {
    const checkIn = await tx.healthCheckIn.upsert({
      where: { retrospectiveId_participantKey: { retrospectiveId: input.retrospectiveId, participantKey } },
      create: { retrospectiveId: input.retrospectiveId, participantKey },
      update: {},
      select: { id: true },
    });

    await tx.healthScore.deleteMany({ where: { checkInId: checkIn.id } });
    await tx.healthScore.createMany({
      data: input.scores.map((score) => ({
        checkInId: checkIn.id,
        retrospectiveId: input.retrospectiveId,
        dimension: score.dimension,
        value: score.value,
      })),
    });
  });

  // Counts only. The one thing the room is told is how far along it is, which
  // is what a facilitator needs to know when to move on — and it is also the
  // most the room can be told without naming who has and hasn't answered.
  const [submitted, expected] = await Promise.all([
    prisma.healthCheckIn.count({ where: { retrospectiveId: input.retrospectiveId } }),
    prisma.retroParticipant.count({ where: { retrospectiveId: input.retrospectiveId } }),
  ]);

  broadcastToRetro(input.retrospectiveId, "health:submitted", { submitted, expected });
  revalidatePath(`/retros/${input.retrospectiveId}`);
  return { submitted, expected };
}

/**
 * What the room may be told.
 *
 * Returns counts and averages only — never a row, never a key. The thresholds
 * are applied here, on the server, so "we don't have enough answers yet" is a
 * fact about the response rather than something the UI politely declines to
 * render.
 */
export async function getHealthSummary(retrospectiveId: string): Promise<HealthSummary> {
  const { user } = await requireRetroAccess(retrospectiveId);
  const salt = await loadSalt(retrospectiveId);
  const participantKey = participantKeyFor(user.id, salt);

  const [submitted, expected, own] = await Promise.all([
    prisma.healthCheckIn.count({ where: { retrospectiveId } }),
    prisma.retroParticipant.count({ where: { retrospectiveId } }),
    prisma.healthCheckIn.findUnique({
      where: { retrospectiveId_participantKey: { retrospectiveId, participantKey } },
      select: { scores: { select: { dimension: true, value: true } } },
    }),
  ]);

  const mine = own ? own.scores : null;

  if (!canShowAverages(submitted)) {
    return {
      submitted,
      expected,
      mine,
      dimensions: [],
      suppressedReason: suppressionReason(submitted),
    };
  }

  const averages = await prisma.healthScore.groupBy({
    by: ["dimension"],
    where: { retrospectiveId },
    _avg: { value: true },
  });
  const averageByDimension = new Map(averages.map((row) => [row.dimension, row._avg.value ?? 0]));

  // Shape leaks more than centre does, so it needs the higher bar. Fetched only
  // when it will actually be returned.
  const distributionByDimension = canShowDistribution(submitted)
    ? await prisma.healthScore
        .groupBy({ by: ["dimension", "value"], where: { retrospectiveId }, _count: { _all: true } })
        .then((rows) => {
          const map = new Map<HealthDimension, number[]>();
          for (const row of rows) {
            const bucket = map.get(row.dimension) ?? [0, 0, 0, 0, 0];
            bucket[row.value - 1] = row._count._all;
            map.set(row.dimension, bucket);
          }
          return map;
        })
    : null;

  return {
    submitted,
    expected,
    mine,
    // Driven by the canonical order rather than by whatever the groupBy
    // returned, so the five dials never reshuffle between refreshes.
    dimensions: HEALTH_DIMENSIONS.filter((dimension) => averageByDimension.has(dimension)).map(
      (dimension) => ({
        dimension,
        average: averageByDimension.get(dimension) ?? 0,
        distribution: distributionByDimension?.get(dimension) ?? null,
      }),
    ),
    suppressedReason: null,
  };
}
