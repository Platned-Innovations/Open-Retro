"use client";

import Card from "@mui/material/Card";
import CardHeader from "@mui/material/CardHeader";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import LinearProgress from "@mui/material/LinearProgress";
import { Gauge, gaugeClasses } from "@mui/x-charts/Gauge";
import { BarChart } from "@mui/x-charts/BarChart";
import { EyeOff, HeartPulse } from "lucide-react";
import { HEALTH_DIMENSION_LABELS, HEALTH_SCALE_MAX, healthTone, HEALTH_TONE_COLOR } from "@/lib/health";
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
    <Card variant="outlined">
      <CardHeader
        title={
          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            <HeartPulse className="h-4 w-4" />
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              Team health
            </Typography>
          </Stack>
        }
      />
      <CardContent sx={{ pt: 0 }}>
        <Stack spacing={2.5}>
          <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
            <LinearProgress
              variant="determinate"
              value={expected === 0 ? 0 : (submitted / expected) * 100}
              aria-label={`${submitted} of ${expected} people have checked in`}
              sx={{ width: "100%", maxWidth: 192, height: 6, borderRadius: 3 }}
            />
            <Typography variant="body2" color="text.secondary">
              {submitted} of {expected} checked in
            </Typography>
          </Stack>

          {suppressedReason ? (
            <Stack spacing={1} sx={{ py: 3, alignItems: "center", color: "text.secondary" }}>
              <EyeOff className="h-8 w-8" style={{ opacity: 0.5 }} />
              <Typography variant="body2" color="text.secondary">
                {suppressedReason}
              </Typography>
            </Stack>
          ) : (
            <Stack direction="row" spacing={3} sx={{ flexWrap: "wrap" }}>
              {dimensions.map((d) => {
                const tone = healthTone(d.average);
                return (
                  <Stack key={d.dimension} spacing={1} sx={{ alignItems: "center" }}>
                    <Gauge
                      value={d.average}
                      valueMin={0}
                      valueMax={HEALTH_SCALE_MAX}
                      startAngle={-135}
                      endAngle={135}
                      width={110}
                      height={110}
                      cornerRadius="50%"
                      text={d.average.toFixed(1)}
                      sx={{
                        [`& .${gaugeClasses.valueArc}`]: { fill: HEALTH_TONE_COLOR[tone] },
                        [`& .${gaugeClasses.valueText} text`]: { fontSize: 18, fontWeight: 700 },
                      }}
                    />
                    <Typography variant="caption" color="text.secondary">
                      {HEALTH_DIMENSION_LABELS[d.dimension]}
                    </Typography>
                    {/* Shape needs a higher bar than centre, so this often isn't
                        here even when the dial is. */}
                    {d.distribution && (
                      <BarChart
                        height={40}
                        width={100}
                        series={[{ data: d.distribution, color: HEALTH_TONE_COLOR[tone] }]}
                        xAxis={[{ scaleType: "band", data: d.distribution.map((_, i) => String(i + 1)), position: "none" }]}
                        yAxis={[{ position: "none" }]}
                        hideLegend
                        margin={{ top: 0, bottom: 0, left: 0, right: 0 }}
                      />
                    )}
                  </Stack>
                );
              })}
            </Stack>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}
