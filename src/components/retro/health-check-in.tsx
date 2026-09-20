"use client";

import { useState } from "react";
import { Button, Card, CardBody, CardHeader, CardTitle, InlineAlert, SegmentedControl } from "@platned/ui";
import { HeartPulse } from "lucide-react";
import type { HealthDimension } from "@/generated/prisma/client";
import {
  HEALTH_DIMENSIONS,
  HEALTH_DIMENSION_LABELS,
  HEALTH_DIMENSION_PROMPTS,
  HEALTH_SCALE_ANCHORS,
  HEALTH_SCALE_MAX,
  HEALTH_SCALE_MIN,
  MIN_SUBMISSIONS_FOR_AVERAGE,
} from "@/lib/health";
import { submitHealthCheckIn } from "@/server/actions/retros";
import { useAction } from "@/lib/useAction";

const SCALE = Array.from({ length: HEALTH_SCALE_MAX - HEALTH_SCALE_MIN + 1 }, (_, i) => ({
  value: String(HEALTH_SCALE_MIN + i),
  label: String(HEALTH_SCALE_MIN + i),
}));

/**
 * Five questions, one minute.
 *
 * Every dimension must be answered before this submits — a partial check-in
 * would give each dimension its own denominator, and the anonymity threshold
 * only holds against a single honest one. The scale has a neutral middle for
 * "no strong view", so requiring all five doesn't force anyone to invent an
 * opinion.
 */
export function HealthCheckIn({
  retrospectiveId,
  mine,
}: {
  retrospectiveId: string;
  /** Previous answers, when this person has already checked in. */
  mine: { dimension: HealthDimension; value: number }[] | null;
}) {
  const { run, isPending } = useAction();
  const [scores, setScores] = useState<Partial<Record<HealthDimension, number>>>(
    () => Object.fromEntries((mine ?? []).map((s) => [s.dimension, s.value])),
  );

  const answered = HEALTH_DIMENSIONS.filter((d) => scores[d] !== undefined).length;
  const complete = answered === HEALTH_DIMENSIONS.length;

  function save() {
    if (!complete) return;
    run(() =>
      submitHealthCheckIn({
        retrospectiveId,
        scores: HEALTH_DIMENSIONS.map((dimension) => ({
          dimension,
          value: scores[dimension] as number,
        })),
      }),
    );
  }

  return (
    <Card>
      <CardHeader size="sm">
        <CardTitle size="sm" className="flex items-center gap-2">
          <HeartPulse className="h-4 w-4 text-brand" />
          {mine ? "Your check-in" : "How was the last sprint?"}
        </CardTitle>
      </CardHeader>
      <CardBody className="gap-5">
        {HEALTH_DIMENSIONS.map((dimension) => (
          <fieldset key={dimension} className="flex flex-col gap-1.5">
            <legend className="text-body-sm font-medium text-default">
              {HEALTH_DIMENSION_LABELS[dimension]}
              <span className="ml-2 font-normal text-default-secondary">
                {HEALTH_DIMENSION_PROMPTS[dimension]}
              </span>
            </legend>
            <div className="flex flex-wrap items-center gap-3">
              <SegmentedControl
                options={SCALE}
                value={scores[dimension] === undefined ? "" : String(scores[dimension])}
                onChange={(value) =>
                  setScores((current) => ({ ...current, [dimension]: Number(value) }))
                }
              />
              {/* Both ends named, in this dimension's own terms. An unlabelled
                  1-5 measures how generous someone is feeling; it is also the
                  only thing that makes "5" unambiguously good news for
                  workload. */}
              <span className="text-body-tiny text-default-secondary">
                {HEALTH_SCALE_ANCHORS[dimension].low} → {HEALTH_SCALE_ANCHORS[dimension].high}
              </span>
            </div>
          </fieldset>
        ))}

        {/* Said before answering, not after. Someone deciding how candid to be
            deserves to know the threshold in advance. */}
        <InlineAlert tone="info">
          Your answers are anonymous, and nothing is shown until at least{" "}
          {MIN_SUBMISSIONS_FOR_AVERAGE} people have checked in.
        </InlineAlert>

        <div className="flex items-center gap-3">
          <Button onClick={save} disabled={!complete || isPending}>
            {mine ? "Update my check-in" : "Submit"}
          </Button>
          {!complete && (
            <span className="text-body-sm text-default-secondary">
              {answered} of {HEALTH_DIMENSIONS.length} answered
            </span>
          )}
        </div>
      </CardBody>
    </Card>
  );
}
