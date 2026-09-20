import Link from "next/link";
import { notFound } from "next/navigation";
import { getRetroBoard, getRelatedRetros } from "@/server/queries/retros";
import { getHealthSummary } from "@/server/retro/health";
import { HealthSummary } from "@/components/retro/health-summary";
import { NotFoundError } from "@/lib/authz";
import { ActionItemsPanel } from "@/components/retro/action-items-panel";
import { BreadcrumbNav } from "@/components/breadcrumb-nav";
import { LinkButton } from "@/components/ui/link-button";
import { Card, CardHeader, CardTitle, CardBody, StatusBadge, Avatar, type StatusTone } from "@platned/ui";
import { TEMPLATE_LABELS } from "@/lib/retroTemplates";
import { effectiveVoteCount } from "@/lib/retroVotes";
import { isUnresolved } from "@/lib/actionItems";
import { ArrowLeft, Download, Heart, ListTree, MessageSquareText } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const STATUS_TONE: Record<string, StatusTone> = {
  DRAFT: "neutral",
  ACTIVE: "positive",
  COMPLETED: "info",
  ARCHIVED: "neutral",
};

export default async function RetroSummaryPage({
  params,
}: {
  params: Promise<{ retroId: string }>;
}) {
  const { retroId } = await params;
  let retro;
  try {
    retro = await getRetroBoard(retroId);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }
  const related = await getRelatedRetros(retro.projectId, retroId);

  // The check-in is otherwise visible for the sixty seconds the board spends in
  // CHECK_IN and never again — insights need a second retrospective before they
  // show anything, so without this a team's first result is lost.
  const healthSummary = retro.checkInEnabled ? await getHealthSummary(retroId) : null;

  return (
    <div className="flex flex-col gap-8">
      <BreadcrumbNav
        items={[
          { label: retro.project.company.name, href: `/companies/${retro.project.companyId}` },
          { label: retro.project.name, href: `/projects/${retro.projectId}` },
          { label: retro.title },
        ]}
      />

      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <LinkButton
            href={`/retros/${retro.id}`}
            variant="subtle"
            size="sm"
            leadingIcon={<ArrowLeft className="h-3.5 w-3.5" />}
            className="-ml-2 w-fit"
          >
            Back to board
          </LinkButton>
          <h1 className="text-heading font-semibold text-default">{retro.title}</h1>
          <p className="text-body-sm text-default-secondary">
            {TEMPLATE_LABELS[retro.template]} · Facilitated by {retro.facilitatorName} ·{" "}
            {formatDistanceToNow(retro.createdAt, { addSuffix: true })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Plain links, not buttons: the response is a file, so the browser's
              own download handling is the whole mechanism — and it means an
              export can be bookmarked, shared or curl'd. */}
          <LinkButton
            href={`/api/retros/${retro.id}/export?format=md`}
            variant="neutral"
            size="sm"
            leadingIcon={<Download className="h-3.5 w-3.5" />}
          >
            Markdown
          </LinkButton>
          <LinkButton
            href={`/api/retros/${retro.id}/export?format=csv`}
            variant="neutral"
            size="sm"
            leadingIcon={<Download className="h-3.5 w-3.5" />}
          >
            Actions CSV
          </LinkButton>
          {retro.actionItems.some((item) => isUnresolved(item.status)) && (
            <StatusBadge
              label={`${retro.actionItems.filter((item) => isUnresolved(item.status)).length} pending`}
              tone="warning"
            />
          )}
          <StatusBadge label={retro.status} tone={STATUS_TONE[retro.status]} />
        </div>
      </div>

      {healthSummary && healthSummary.submitted > 0 && (
        <HealthSummary summary={healthSummary} />
      )}

      <ActionItemsPanel
        retrospectiveId={retro.id}
        actionItems={retro.actionItems}
        members={retro.assignableMembers}
      />

      <div>
        <h2 className="mb-3 flex items-center gap-2 text-heading-sm font-semibold text-default">
          <ListTree className="h-4 w-4" />
          Board recap
        </h2>
        {/* Column count comes from the template, so a 4Ls or custom board gets
            its own columns rather than being wrapped into a hardcoded three. */}
        <div
          className="grid gap-4"
          style={{
            gridTemplateColumns: `repeat(${Math.min(retro.columns.length, 4)}, minmax(0, 1fr))`,
          }}
        >
          {retro.columns.map((column) => {
            // effectiveVoteCount folds in merged children, so a card that
            // three people raised separately outranks one that one person did.
            const topLevel = column.cards
              .filter((c) => !c.groupId)
              .sort((a, b) => effectiveVoteCount(b) - effectiveVoteCount(a));
            return (
              <Card key={column.id}>
                <CardHeader size="sm">
                  <CardTitle size="sm" className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: column.color }} />
                    {column.title}
                  </CardTitle>
                </CardHeader>
                <CardBody className="gap-2">
                  {topLevel.length === 0 && (
                    <p className="text-body-sm text-default-secondary">No cards.</p>
                  )}
                  {topLevel.map((card) => {
                    const authorName = card.authorName ?? "Anonymous";
                    return (
                      <div key={card.id} className="rounded-md border border-default p-2.5 text-body-sm">
                        <p className="whitespace-pre-wrap text-default">{card.content}</p>
                        <div className="mt-2 flex items-center justify-between text-body-tiny text-default-secondary">
                          <div className="flex items-center gap-1">
                            <Avatar type="initial" initial={authorName.slice(0, 1).toUpperCase()} size="sm" />
                            {authorName}
                            {card.grouped.length > 0 && ` · +${card.grouped.length} merged`}
                          </div>
                          <div className="flex items-center gap-2">
                            {card.comments.length > 0 && (
                              <span className="flex items-center gap-0.5">
                                <MessageSquareText className="h-3 w-3" />
                                {card.comments.length}
                              </span>
                            )}
                            <span className="flex items-center gap-0.5">
                              <Heart className="h-3 w-3" />
                              {effectiveVoteCount(card)}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </CardBody>
              </Card>
            );
          })}
        </div>
      </div>

      {related.length > 0 && (
        <div>
          <h2 className="mb-3 text-heading-sm font-semibold text-default">Related content</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {related.map((r) => (
              <Link
                key={r.id}
                href={`/retros/${r.id}/summary`}
                className="flex flex-col gap-1 rounded-lg border border-default p-3 transition-colors hover:bg-default-secondary"
              >
                <div className="flex items-center gap-2 text-body-sm font-medium text-default">
                  <ListTree className="h-3.5 w-3.5 text-default-secondary" />
                  Retrospective: {r.title}
                </div>
                <span className="text-body-tiny text-default-secondary">
                  {r.facilitator.name} · {formatDistanceToNow(r.createdAt, { addSuffix: true })}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
