"use client";

import {
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  EmptyState,
  MiniBarChart,
  ProgressBar,
  RadialGauge,
} from "@platned/ui";
import { EyeOff, HeartPulse } from "lucide-react";
import {
  HEALTH_DIMENSION_LABELS,
  HEALTH_SCALE_MAX,
  healthTone,
} from "@/lib/health";
import type { HealthSummary as HealthSummaryData } from "@/server/retro/health";

/**
 * What the room is allowed to see.
 *
 * The suppression is not rendered politely on top of a full dataset — the
 * server sent no dimensions at all. This component cannot leak what it was
 * never given, which is the point of putting the threshold in the query.
 */
export function HealthSummary({ summary }: { summary: HealthSummaryData }) {
  const { submitted, expected, dimensions, suppressedReason } = summary;

  return (
    <Card>
      <CardHeader size="sm">
        <CardTitle size="sm" className="flex items-center gap-2">
          <HeartPulse className="h-4 w-4 text-brand" />
          Team health
        </CardTitle>
      </CardHeader>
      <CardBody className="gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <ProgressBar
            value={expected === 0 ? 0 : (submitted / expected) * 100}
            tone="brand"
            size="sm"
            className="max-w-48"
            aria-label={`${submitted} of ${expected} people have checked in`}
          />
          <span className="text-body-sm text-default-secondary">
            {submitted} of {expected} checked in
          </span>
        </div>

        {suppressedReason ? (
          <EmptyState icon={<EyeOff className="h-8 w-8" />} message={suppressedReason} />
        ) : (
          <div className="flex flex-wrap gap-6">
            {dimensions.map((d) => (
              <div key={d.dimension} className="flex flex-col items-center gap-2">
                <RadialGauge
                  value={d.average}
                  max={HEALTH_SCALE_MAX}
                  sweep={270}
                  tone={healthTone(d.average)}
                  centerLabel={HEALTH_DIMENSION_LABELS[d.dimension]}
                  label={`${HEALTH_DIMENSION_LABELS[d.dimension]}: ${d.average.toFixed(1)} out of ${HEALTH_SCALE_MAX}`}
                >
                  {d.average.toFixed(1)}
                </RadialGauge>
                {/* Shape needs a higher bar than centre, so this often isn't
                    here even when the dial is. */}
                {d.distribution && (
                  <MiniBarChart
                    bars={d.distribution}
                    highlight={[]}
                    size="sm"
                    label={`${HEALTH_DIMENSION_LABELS[d.dimension]} spread, 1 to ${HEALTH_SCALE_MAX}`}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
