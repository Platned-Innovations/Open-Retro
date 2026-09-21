"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardHeader from "@mui/material/CardHeader";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import ToggleButton from "@mui/material/ToggleButton";
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

const SCALE = Array.from({ length: HEALTH_SCALE_MAX - HEALTH_SCALE_MIN + 1 }, (_, i) => HEALTH_SCALE_MIN + i);

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
  const [scores, setScores] = useState<Partial<Record<HealthDimension, number>>>(() =>
    Object.fromEntries((mine ?? []).map((s) => [s.dimension, s.value])),
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
    <Card variant="outlined">
      <CardHeader
        title={
          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            <HeartPulse className="h-4 w-4" />
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              {mine ? "Your check-in" : "How was the last sprint?"}
            </Typography>
          </Stack>
        }
      />
      <CardContent sx={{ pt: 0 }}>
        <Stack spacing={3}>
          {HEALTH_DIMENSIONS.map((dimension) => (
            <Box component="fieldset" key={dimension} sx={{ border: 0, p: 0, m: 0 }}>
              <Typography component="legend" variant="body2" sx={{ fontWeight: 500, p: 0 }}>
                {HEALTH_DIMENSION_LABELS[dimension]}
                <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                  {HEALTH_DIMENSION_PROMPTS[dimension]}
                </Typography>
              </Typography>
              <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", flexWrap: "wrap", mt: 0.75 }}>
                <ToggleButtonGroup
                  exclusive
                  size="small"
                  value={scores[dimension] === undefined ? null : scores[dimension]}
                  onChange={(_, value: number | null) => {
                    if (value === null) return;
                    setScores((current) => ({ ...current, [dimension]: value }));
                  }}
                >
                  {SCALE.map((n) => (
                    <ToggleButton key={n} value={n} sx={{ minWidth: 36 }}>
                      {n}
                    </ToggleButton>
                  ))}
                </ToggleButtonGroup>
                {/* Both ends named, in this dimension's own terms. An unlabelled
                    1-5 measures how generous someone is feeling; it is also the
                    only thing that makes "5" unambiguously good news for
                    workload. */}
                <Typography variant="caption" color="text.secondary">
                  {HEALTH_SCALE_ANCHORS[dimension].low} → {HEALTH_SCALE_ANCHORS[dimension].high}
                </Typography>
              </Stack>
            </Box>
          ))}

          {/* Said before answering, not after. Someone deciding how candid to be
              deserves to know the threshold in advance. */}
          <Alert severity="info">
            Your answers are anonymous, and nothing is shown until at least {MIN_SUBMISSIONS_FOR_AVERAGE} people have checked in.
          </Alert>

          <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
            <Button variant="contained" onClick={save} disabled={!complete || isPending}>
              {mine ? "Update my check-in" : "Submit"}
            </Button>
            {!complete && (
              <Typography variant="body2" color="text.secondary">
                {answered} of {HEALTH_DIMENSIONS.length} answered
              </Typography>
            )}
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}
