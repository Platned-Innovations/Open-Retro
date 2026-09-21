import { notFound } from "next/navigation";
import { format } from "date-fns";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Grid from "@mui/material/Grid";
import Paper from "@mui/material/Paper";
import Card from "@mui/material/Card";
import CardHeader from "@mui/material/CardHeader";
import CardContent from "@mui/material/CardContent";
import LinearProgress from "@mui/material/LinearProgress";
import { BarChart } from "@mui/x-charts/BarChart";
import { PieChart } from "@mui/x-charts/PieChart";
import { SparkLineChart } from "@mui/x-charts/SparkLineChart";
import { Gauge, gaugeClasses } from "@mui/x-charts/Gauge";
import BarChartIcon from "@mui/icons-material/BarChart";
import FavoriteBorderIcon from "@mui/icons-material/FavoriteBorder";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import { BreadcrumbNav } from "@/components/breadcrumb-nav";
import { NavLinkButton } from "@/components/mui/nav-link";
import { NotFoundError } from "@/lib/authz";
import { getProject } from "@/server/queries/projects";
import { getProjectInsights } from "@/server/queries/insights";
import { ACTION_STATUS_LABELS, ACTION_STATUS_ORDER } from "@/lib/actionItems";
import { ACTION_STATUS_CHART_COLOR } from "@/lib/insights/tones";
import { CHART_CATEGORICAL, CHART_DIVERGING } from "@/lib/chartPalette";
import { HEALTH_DIMENSION_LABELS, HEALTH_SCALE_MAX, MIN_SUBMISSIONS_FOR_AVERAGE, healthTone } from "@/lib/health";

const HEALTH_TONE_COLOR: Record<ReturnType<typeof healthTone>, string> = {
  positive: "#0ca30c",
  warning: "#fab219",
  danger: "#d03b3b",
};

function StatTile({ label, value, tone }: { label: string; value: string | number; tone?: "positive" | "warning" | "neutral" }) {
  const color = tone === "positive" ? "success.main" : tone === "warning" ? "warning.main" : "text.primary";
  return (
    <Paper variant="outlined" sx={{ p: 2.5 }}>
      <Typography variant="h4" sx={{ fontWeight: 700, color }}>
        {value}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
    </Paper>
  );
}

/**
 * What the last several retrospectives actually produced.
 *
 * Built entirely on the project's own data — no model call, no data leaving the
 * infrastructure — so it works regardless of whether AI features are ever
 * switched on.
 */
export default async function ProjectInsightsPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ limit?: string }>;
}) {
  const { projectId } = await params;
  const { limit } = await searchParams;

  let project;
  try {
    project = await getProject(projectId);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  const insights = await getProjectInsights({
    projectId,
    limit: limit ? Number(limit) : undefined,
  });

  const breadcrumb = [
    { label: project.company.name, href: `/companies/${project.companyId}` },
    { label: project.name, href: `/projects/${projectId}` },
    { label: "Insights" },
  ];

  // A trend needs at least two points. Drawing a "chart" of one retro implies a
  // direction that isn't there.
  if (insights.retros.length < 2) {
    return (
      <Stack spacing={4}>
        <BreadcrumbNav items={breadcrumb} />
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            Insights
          </Typography>
          <Typography variant="body1" color="text.secondary">
            {project.name}
          </Typography>
        </Box>
        <Stack spacing={1.5} sx={{ py: 8, alignItems: "center", color: "text.secondary" }}>
          <BarChartIcon sx={{ fontSize: 40, opacity: 0.5 }} />
          <Typography variant="body1" color="text.secondary">
            Insights appear once this project has run its second retrospective — one board isn&apos;t a trend.
          </Typography>
        </Stack>
      </Stack>
    );
  }

  const labels = insights.retros.map((r) => format(r.createdAt, "d MMM"));
  const participationRate = insights.retros.map((r) =>
    insights.memberCount === 0 ? 0 : Math.round((r.participantCount / insights.memberCount) * 100),
  );
  const latestParticipation = participationRate.at(-1) ?? 0;
  const previousParticipation = participationRate.at(-2) ?? latestParticipation;

  const donutSegments = ACTION_STATUS_ORDER.filter((status) => insights.actionsByStatus[status] > 0).map((status) => ({
    id: status,
    label: ACTION_STATUS_LABELS[status],
    value: insights.actionsByStatus[status],
    color: ACTION_STATUS_CHART_COLOR[status],
  }));

  const totalActions = ACTION_STATUS_ORDER.reduce((sum, status) => sum + insights.actionsByStatus[status], 0);
  const completionLabel = insights.completionRate === null ? "—" : `${Math.round(insights.completionRate * 100)}%`;

  const maxThemeScore = Math.max(...insights.themes.map((t) => t.retroCount), 1);

  return (
    <Stack spacing={4}>
      <BreadcrumbNav items={breadcrumb} />

      <Stack direction="row" sx={{ alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 2 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            Insights
          </Typography>
          <Typography variant="body1" color="text.secondary">
            The last {insights.retros.length} retrospectives in {project.name}.
          </Typography>
        </Box>
        <NavLinkButton href={`/projects/${projectId}`} variant="outlined" size="small">
          Back to project
        </NavLinkButton>
      </Stack>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatTile label="Retrospectives" value={insights.retros.length} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatTile
            label="Participation"
            value={`${latestParticipation}%`}
            tone={latestParticipation >= previousParticipation ? "positive" : "warning"}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatTile
            label="Actions completed"
            value={completionLabel}
            tone={insights.completionRate === null ? "neutral" : insights.completionRate >= 0.6 ? "positive" : "warning"}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatTile label="Typically closed in" value={insights.medianDaysToClose === null ? "—" : `${Math.round(insights.medianDaysToClose)}d`} />
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, lg: 6 }}>
          <Card variant="outlined">
            <CardHeader title={<Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Who turned up</Typography>} />
            <CardContent sx={{ pt: 0 }}>
              <BarChart
                height={240}
                xAxis={[{ scaleType: "band", data: labels }]}
                series={[
                  { label: "Participants", data: insights.retros.map((r) => r.participantCount), color: CHART_CATEGORICAL[0] },
                  { label: "Cards written", data: insights.retros.map((r) => r.cardCount), color: CHART_CATEGORICAL[1] },
                ]}
                borderRadius={4}
              />
              <Typography variant="caption" color="text.secondary">
                Out of {insights.memberCount} project member{insights.memberCount === 1 ? "" : "s"}.
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, lg: 6 }}>
          <Card variant="outlined">
            <CardHeader title={<Typography variant="subtitle1" sx={{ fontWeight: 600 }}>What happened to the actions</Typography>} />
            <CardContent sx={{ pt: 0 }}>
              {totalActions === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: "center" }}>
                  No action items yet.
                </Typography>
              ) : (
                <Stack direction="row" spacing={3} sx={{ alignItems: "center" }}>
                  <Box sx={{ position: "relative", width: 160, height: 160, flexShrink: 0 }}>
                    <PieChart
                      series={[{ data: donutSegments, innerRadius: 45, outerRadius: 78, paddingAngle: 2, cornerRadius: 3 }]}
                      width={160}
                      height={160}
                      hideLegend
                      slotProps={{ tooltip: { trigger: "item" } }}
                    />
                    <Box
                      sx={{
                        position: "absolute",
                        inset: 0,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        pointerEvents: "none",
                      }}
                    >
                      <Typography variant="h6" sx={{ fontWeight: 700 }}>
                        {completionLabel}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        done
                      </Typography>
                    </Box>
                  </Box>
                  <Stack spacing={0.75} sx={{ flex: 1 }}>
                    {donutSegments.map((s) => (
                      <Stack key={s.id} direction="row" spacing={1} sx={{ alignItems: "center" }}>
                        <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: s.color, flexShrink: 0 }} />
                        <Typography variant="body2">
                          {s.label} ({s.value})
                        </Typography>
                      </Stack>
                    ))}
                    {/* Dropped work is excluded from the rate on purpose — deciding
                        not to do something is a real outcome, not a failure. */}
                    {insights.actionsByStatus.DROPPED > 0 && (
                      <Typography variant="caption" color="text.secondary">
                        Dropped items aren&apos;t counted in the completion rate.
                      </Typography>
                    )}
                  </Stack>
                </Stack>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, lg: 6 }}>
          <Card variant="outlined">
            <CardHeader title={<Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Engagement</Typography>} />
            <CardContent sx={{ pt: 0, display: "flex", flexDirection: "column", gap: 3 }}>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Votes cast
                </Typography>
                <SparkLineChart
                  data={insights.retros.map((r) => r.voteCount)}
                  height={60}
                  area
                  showHighlight
                  color={CHART_CATEGORICAL[0]}
                />
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Board sentiment — positive versus negative cards
                </Typography>
                <BarChart
                  height={70}
                  xAxis={[{ scaleType: "band", data: labels, position: "none" }]}
                  yAxis={[{ min: -50, max: 50, position: "none" }]}
                  series={[
                    {
                      data: insights.retros.map((r) => Math.round((r.sentimentScore ?? 0) * 50)),
                      color: CHART_DIVERGING.positive,
                    },
                  ]}
                  borderRadius={3}
                  hideLegend
                  grid={{ horizontal: false }}
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, lg: 6 }}>
          <Card variant="outlined">
            <CardHeader title={<Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Follow-through</Typography>} />
            <CardContent sx={{ pt: 0 }}>
              <Stack spacing={1}>
                <Typography variant="body2">
                  {insights.carriedOverCount} item{insights.carriedOverCount === 1 ? " has" : "s have"} been carried into a later
                  retrospective.
                </Typography>
                {insights.stalledCount > 0 && (
                  <Typography variant="body2" color="warning.main">
                    {insights.stalledCount} of those {insights.stalledCount === 1 ? "is" : "are"} still outstanding.
                  </Typography>
                )}
                <Typography variant="caption" color="text.secondary">
                  Work that keeps reappearing is usually blocked on something the retro hasn&apos;t named yet.
                </Typography>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Hidden outright when no retro had enough answers, rather than drawn as
          a flat line at zero — an empty chart reads as "morale is nil". */}
      {insights.health.trends.length > 0 && (
        <Box>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 1.5 }}>
            <FavoriteBorderIcon fontSize="small" />
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Team health
            </Typography>
          </Stack>
          <Paper variant="outlined" sx={{ p: 3 }}>
            <Stack direction="row" spacing={4} sx={{ flexWrap: "wrap" }}>
              {insights.health.trends.map((trend) => {
                const latest = trend.points.at(-1)?.average ?? 0;
                const tone = healthTone(latest);
                return (
                  <Stack key={trend.dimension} spacing={1} sx={{ alignItems: "center" }}>
                    <Gauge
                      value={latest}
                      valueMin={0}
                      valueMax={HEALTH_SCALE_MAX}
                      startAngle={-135}
                      endAngle={135}
                      width={120}
                      height={120}
                      cornerRadius="50%"
                      text={`${latest.toFixed(1)}`}
                      sx={{
                        [`& .${gaugeClasses.valueArc}`]: { fill: HEALTH_TONE_COLOR[tone] },
                        [`& .${gaugeClasses.valueText} text`]: { fontSize: 20, fontWeight: 700 },
                      }}
                    />
                    <Typography variant="caption" color="text.secondary">
                      {HEALTH_DIMENSION_LABELS[trend.dimension]}
                    </Typography>
                    {trend.points.length > 1 && (
                      <SparkLineChart
                        data={trend.points.map((p) => p.average)}
                        width={100}
                        height={32}
                        showHighlight
                        color={HEALTH_TONE_COLOR[tone]}
                      />
                    )}
                  </Stack>
                );
              })}
            </Stack>
          </Paper>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
            Anonymous check-ins, averaged. A retrospective is only shown once at least {MIN_SUBMISSIONS_FOR_AVERAGE} people answered it
            {insights.health.suppressedRetros > 0 && (
              <>
                {" "}
                — {insights.health.suppressedRetros} {insights.health.suppressedRetros === 1 ? "is" : "are"} left out on that basis, so
                the points are not evenly spaced in time
              </>
            )}
            .
          </Typography>
        </Box>
      )}

      <Box>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 1.5 }}>
          <AccountTreeIcon fontSize="small" />
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Recurring themes
          </Typography>
        </Stack>
        {insights.themes.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No wording has recurred across enough retrospectives yet.
          </Typography>
        ) : (
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Stack spacing={1.5}>
              {insights.themes.map((theme, index) => (
                <Stack key={theme.term} direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
                  <Typography variant="body2" color="text.secondary" sx={{ width: 20, textAlign: "right" }}>
                    {index + 1}
                  </Typography>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Stack direction="row" sx={{ justifyContent: "space-between" }}>
                      <Typography variant="body2" sx={{ fontWeight: 500 }} noWrap>
                        {theme.term}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {theme.retroCount} retrospectives · {theme.cardCount} cards
                      </Typography>
                    </Stack>
                    <LinearProgress
                      variant="determinate"
                      value={(theme.retroCount / maxThemeScore) * 100}
                      sx={{ height: 4, borderRadius: 2, mt: 0.5, [`& .MuiLinearProgress-bar`]: { bgcolor: CHART_CATEGORICAL[0] } }}
                    />
                  </Box>
                </Stack>
              ))}
            </Stack>
          </Paper>
        )}
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
          Repeated wording across boards, ranked by how many retrospectives mention it — a prompt to look closer, not an analysis.
        </Typography>
      </Box>
    </Stack>
  );
}
