import Link from "next/link";
import { Card, CardBody, EmptyState, PageHeading, StatusBadge } from "@platned/ui";
import { ListChecks } from "lucide-react";
import { format } from "date-fns";
import {
  listMyActionItems,
  listMyActionProjects,
  type MyActionItem,
} from "@/server/queries/myActions";
import { MyActionStatus } from "@/components/actions/my-action-row";
import { LinkButton } from "@/components/ui/link-button";
import { UNRESOLVED_STATUSES, isOverdue } from "@/lib/actionItems";
import type { ActionItemStatus } from "@/generated/prisma/client";

/**
 * Everything assigned to me, across every project.
 *
 * The tool has been emailing people about action items since the beginning
 * while giving them nowhere to see them — you could only find your own work by
 * remembering which retro it came out of. This is that page.
 *
 * Filters go through searchParams rather than client state, so the whole thing
 * stays a Server Component and a filtered view is a shareable URL.
 */
export default async function MyActionsPage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string; show?: string }>;
}) {
  const { projectId, show } = await searchParams;
  const showAll = show === "all";

  const [items, projects] = await Promise.all([
    listMyActionItems({
      projectId,
      status: showAll ? undefined : [...UNRESOLVED_STATUSES],
    }),
    listMyActionProjects(),
  ]);

  const byProject = new Map<string, { name: string; companyName: string; items: MyActionItem[] }>();
  for (const item of items) {
    const project = item.retrospective.project;
    const group = byProject.get(project.id) ?? {
      name: project.name,
      companyName: project.company.name,
      items: [],
    };
    group.items.push(item);
    byProject.set(project.id, group);
  }

  const query = (next: { projectId?: string; show?: string }) => {
    const params = new URLSearchParams();
    const nextProject = "projectId" in next ? next.projectId : projectId;
    const nextShow = "show" in next ? next.show : show;
    if (nextProject) params.set("projectId", nextProject);
    if (nextShow) params.set("show", nextShow);
    const qs = params.toString();
    return qs ? `/my-actions?${qs}` : "/my-actions";
  };

  return (
    <div className="flex flex-col gap-8">
      <PageHeading
        title="My action items"
        subtitle="Everything assigned to you, across every project."
      />

      <div className="flex flex-wrap items-center gap-2">
        <LinkButton href={query({ show: showAll ? undefined : "all" })} variant="neutral" size="sm">
          {showAll ? "Show outstanding only" : "Include finished"}
        </LinkButton>
        <span className="mx-1 h-4 w-px bg-divider" aria-hidden />
        <LinkButton
          href={query({ projectId: undefined })}
          variant={projectId ? "neutral" : "primary"}
          size="sm"
        >
          All projects
        </LinkButton>
        {projects.map((project) => (
          <LinkButton
            key={project.id}
            href={query({ projectId: project.id })}
            variant={projectId === project.id ? "primary" : "neutral"}
            size="sm"
          >
            {project.name}
          </LinkButton>
        ))}
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={<ListChecks className="h-8 w-8" />}
          message={
            showAll
              ? "Nothing has been assigned to you yet."
              : "Nothing outstanding. Anything finished is hidden — use “Include finished” to see it."
          }
          size="lg"
        />
      ) : (
        <div className="flex flex-col gap-6">
          {[...byProject.entries()].map(([id, group]) => (
            <div key={id} className="flex flex-col gap-2">
              <h2 className="text-heading-sm font-semibold text-default">
                {group.name}
                <span className="ml-2 text-body-sm font-normal text-default-secondary">
                  {group.companyName}
                </span>
              </h2>
              <Card className="overflow-visible">
                <CardBody size="sm" className="flex flex-col gap-0 divide-y divide-divider p-0">
                  {group.items.map((item) => (
                    <ActionRow key={item.id} item={item} />
                  ))}
                </CardBody>
              </Card>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ActionRow({ item }: { item: MyActionItem }) {
  const overdue = isOverdue({ dueDate: item.dueDate, status: item.status as ActionItemStatus });

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 p-3">
      <div className="flex min-w-0 flex-col gap-1">
        <span className="text-body-sm text-default">{item.description}</span>
        <div className="flex flex-wrap items-center gap-2 text-body-tiny text-default-secondary">
          <Link href={`/retros/${item.retrospective.id}`} className="hover:text-brand">
            {item.retrospective.title}
          </Link>
          {item.dueDate && (
            <StatusBadge
              label={`Due ${format(item.dueDate, "MMM d")}`}
              tone={overdue ? "danger" : "neutral"}
              size="sm"
            />
          )}
          {/* An item that has followed the team through several retros is worth
              surfacing here more than anywhere — this is the page where someone
              can actually do something about it. */}
          {item._count.carryOvers > 0 && (
            <StatusBadge
              label={
                item._count.carryOvers === 1
                  ? "carried over once"
                  : `carried over ${item._count.carryOvers} times`
              }
              tone={item._count.carryOvers > 2 ? "warning" : "neutral"}
              size="sm"
            />
          )}
        </div>
      </div>

      <MyActionStatus
        retrospectiveId={item.retrospective.id}
        actionItemId={item.id}
        status={item.status}
        description={item.description}
      />
    </div>
  );
}
