import { notFound } from "next/navigation";
import { format } from "date-fns";
import {
  BarChart,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  ChartLegend,
  DonutChart,
  EmptyState,
  MiniBarChart,
  PageHeading,
  RadialGauge,
  RankedRow,
  Sparkline,
  StatTile,
  TileGrid,
} from "@platned/ui";
import { ChartNoAxesColumn, HeartPulse, ListTree } from "lucide-react";
import { BreadcrumbNav } from "@/components/breadcrumb-nav";
import { LinkButton } from "@/components/ui/link-button";
import { NotFoundError } from "@/lib/authz";
import { getProject } from "@/server/queries/projects";
import { getProjectInsights } from "@/server/queries/insights";
import { ACTION_STATUS_LABELS, ACTION_STATUS_ORDER } from "@/lib/actionItems";
import { ACTION_STATUS_CHART_TONE } from "@/lib/insights/tones";
import {
  HEALTH_DIMENSION_LABELS,
  HEALTH_SCALE_MAX,
  MIN_SUBMISSIONS_FOR_AVERAGE,
  healthTone,
} from "@/lib/health";

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

  // A trend needs at least two points. Drawing a "chart" of one retro implies a
  // direction that isn't there.
  if (insights.retros.length < 2) {
    return (
      <div className="flex flex-col gap-8">
        <BreadcrumbNav
          items={[
            { label: project.company.name, href: `/companies/${project.companyId}` },
            { label: project.name, href: `/projects/${projectId}` },
            { label: "Insights" },
          ]}
        />
        <PageHeading title="Insights" subtitle={project.name} />
        <EmptyState
          icon={<ChartNoAxesColumn className="h-8 w-8" />}
          message="Insights appear once this project has run its second retrospective — one board isn't a trend."
          size="lg"
        />
      </div>
    );
  }

  const labels = insights.retros.map((r) => format(r.createdAt, "d MMM"));
  const participationRate = insights.retros.map((r) =>
    insights.memberCount === 0 ? 0 : Math.round((r.participantCount / insights.memberCount) * 100),
  );
  const latestParticipation = participationRate.at(-1) ?? 0;
  const previousParticipation = participationRate.at(-2) ?? latestParticipation;

  const donutSegments = ACTION_STATUS_ORDER.filter(
    (status) => insights.actionsByStatus[status] > 0,
  ).map((status) => ({
    label: ACTION_STATUS_LABELS[status],
    value: insights.actionsByStatus[status],
    tone: ACTION_STATUS_CHART_TONE[status],
  }));

  const totalActions = ACTION_STATUS_ORDER.reduce(
    (sum, status) => sum + insights.actionsByStatus[status],
    0,
  );

  return (
    <div className="flex flex-col gap-8">
      <BreadcrumbNav
        items={[
          { label: project.company.name, href: `/companies/${project.companyId}` },
          { label: project.name, href: `/projects/${projectId}` },
          { label: "Insights" },
        ]}
      />

      <PageHeading
        title="Insights"
        subtitle={`The last ${insights.retros.length} retrospectives in ${project.name}.`}
        actions={
          <LinkButton href={`/projects/${projectId}`} variant="neutral" size="md">
            Back to project
          </LinkButton>
        }
      />

      <TileGrid columns={4}>
        <StatTile label="Retrospectives" value={insights.retros.length} />
        <StatTile
          label="Participation"
          value={`${latestParticipation}%`}
          tone={latestParticipation >= previousParticipation ? "positive" : "warning"}
        />
        <StatTile
          label="Actions completed"
          value={
            insights.completionRate === null ? "—" : `${Math.round(insights.completionRate * 100)}%`
          }
          tone={
            insights.completionRate === null
              ? "neutral"
              : insights.completionRate >= 0.6
                ? "positive"
                : "warning"
          }
        />
        <StatTile
          label="Typically closed in"
          value={
            insights.medianDaysToClose === null
              ? "—"
              : `${Math.round(insights.medianDaysToClose)}d`
          }
        />
      </TileGrid>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader size="sm">
            <CardTitle size="sm">Who turned up</CardTitle>
          </CardHeader>
          <CardBody className="gap-3">
            <BarChart
              categories={labels}
              series={[
                {
                  label: "Participants",
                  values: insights.retros.map((r) => r.participantCount),
                  tone: "brand",
                },
                {
                  label: "Cards written",
                  values: insights.retros.map((r) => r.cardCount),
                  tone: "info",
                },
              ]}
              showLabels
              label="Participants and cards per retrospective"
            />
            <p className="text-body-tiny text-default-secondary">
              Out of {insights.memberCount} project member
              {insights.memberCount === 1 ? "" : "s"}.
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader size="sm">
            <CardTitle size="sm">What happened to the actions</CardTitle>
          </CardHeader>
          <CardBody className="flex-row items-center gap-6">
            {totalActions === 0 ? (
              <EmptyState message="No action items yet." />
            ) : (
              <>
                <DonutChart
                  segments={donutSegments}
                  centerValue={
                    insights.completionRate === null
                      ? "—"
                      : `${Math.round(insights.completionRate * 100)}%`
                  }
                  centerLabel="done"
                  label="Action items by status"
                />
                <div className="flex flex-col gap-2">
                  <ChartLegend
                    items={donutSegments.map((s) => ({ label: `${s.label} (${s.value})`, tone: s.tone }))}
                    orientation="vertical"
                  />
                  {/* Dropped work is excluded from the rate on purpose — deciding
                      not to do something is a real outcome, not a failure. */}
                  {insights.actionsByStatus.DROPPED > 0 && (
                    <p className="text-body-tiny text-default-secondary">
                      Dropped items aren&apos;t counted in the completion rate.
                    </p>
                  )}
                </div>
              </>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader size="sm">
            <CardTitle size="sm">Engagement</CardTitle>
          </CardHeader>
          <CardBody className="gap-4">
            <div className="flex flex-col gap-1">
              <span className="text-body-tiny text-default-secondary">Votes cast</span>
              <Sparkline
                data={insights.retros.map((r) => r.voteCount)}
                variant="area"
                tone="brand"
                showEndDot
                label="Votes cast per retrospective"
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-body-tiny text-default-secondary">
                Board sentiment — positive versus negative cards
              </span>
              <MiniBarChart
                bars={insights.retros.map((r) => Math.round(((r.sentimentScore ?? 0) + 1) * 50))}
                highlight={-1}
                label="Sentiment per retrospective"
              />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader size="sm">
            <CardTitle size="sm">Follow-through</CardTitle>
          </CardHeader>
          <CardBody className="gap-3">
            <div className="flex flex-col gap-1 text-body-sm">
              <span className="text-default">
                {insights.carriedOverCount} item
                {insights.carriedOverCount === 1 ? " has" : "s have"} been carried into a later
                retrospective.
              </span>
              {insights.stalledCount > 0 && (
                <span className="text-warning">
                  {insights.stalledCount} of those {insights.stalledCount === 1 ? "is" : "are"} still
                  outstanding.
                </span>
              )}
            </div>
            <p className="text-body-tiny text-default-secondary">
              Work that keeps reappearing is usually blocked on something the retro hasn&apos;t
              named yet.
            </p>
          </CardBody>
        </Card>
      </div>

      {/* Hidden outright when no retro had enough answers, rather than drawn as
          a flat line at zero — an empty chart reads as "morale is nil". */}
      {insights.health.trends.length > 0 && (
        <div>
          <h2 className="mb-3 flex items-center gap-2 text-heading-sm font-semibold text-default">
            <HeartPulse className="h-4 w-4" />
            Team health
          </h2>
          <Card>
            <CardBody className="flex-row flex-wrap gap-8">
              {insights.health.trends.map((trend) => {
                const latest = trend.points.at(-1)?.average ?? 0;
                return (
                  <div key={trend.dimension} className="flex flex-col items-center gap-2">
                    <RadialGauge
                      value={latest}
                      max={HEALTH_SCALE_MAX}
                      sweep={270}
                      tone={healthTone(latest)}
                      centerLabel={HEALTH_DIMENSION_LABELS[trend.dimension]}
                      label={`${HEALTH_DIMENSION_LABELS[trend.dimension]}: ${latest.toFixed(1)} out of ${HEALTH_SCALE_MAX} in the latest retrospective`}
                    >
                      {latest.toFixed(1)}
                    </RadialGauge>
                    {trend.points.length > 1 && (
                      <Sparkline
                        data={trend.points.map((p) => p.average)}
                        tone={healthTone(latest)}
                        showEndDot
                        label={`${HEALTH_DIMENSION_LABELS[trend.dimension]} over ${trend.points.length} retrospectives`}
                      />
                    )}
                  </div>
                );
              })}
            </CardBody>
          </Card>
          <p className="mt-2 text-body-tiny text-default-secondary">
            Anonymous check-ins, averaged. A retrospective is only shown once at least{" "}
            {MIN_SUBMISSIONS_FOR_AVERAGE} people answered it
            {insights.health.suppressedRetros > 0 && (
              <>
                {" "}— {insights.health.suppressedRetros}{" "}
                {insights.health.suppressedRetros === 1 ? "is" : "are"} left out on that basis, so
                the points are not evenly spaced in time
              </>
            )}
            .
          </p>
        </div>
      )}

      <div>
        <h2 className="mb-3 flex items-center gap-2 text-heading-sm font-semibold text-default">
          <ListTree className="h-4 w-4" />
          Recurring themes
        </h2>
        {insights.themes.length === 0 ? (
          <EmptyState message="No wording has recurred across enough retrospectives yet." />
        ) : (
          <Card>
            <CardBody size="sm" className="flex flex-col gap-0 divide-y divide-divider p-0">
              {insights.themes.map((theme, index) => (
                <RankedRow
                  key={theme.term}
                  rank={index + 1}
                  name={theme.term}
                  sublabel={`${theme.retroCount} retrospectives · ${theme.cardCount} cards`}
                  score={theme.retroCount}
                  tone="auto"
                />
              ))}
            </CardBody>
          </Card>
        )}
        <p className="mt-2 text-body-tiny text-default-secondary">
          Repeated wording across boards, ranked by how many retrospectives mention it — a prompt to
          look closer, not an analysis.
        </p>
      </div>
    </div>
  );
}
