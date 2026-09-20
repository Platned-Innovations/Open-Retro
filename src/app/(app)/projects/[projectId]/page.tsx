import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { isCompanyAdmin, NotFoundError } from "@/lib/authz";
import { getProject } from "@/server/queries/projects";
import { listAddableCompanyMembers } from "@/server/queries/invitations";
import { InviteMemberDialog } from "@/components/invite-member-dialog";
import { NewRetroDialog } from "@/components/new-retro-dialog";
import { MembersPanel } from "@/components/members-panel";
import { BreadcrumbNav } from "@/components/breadcrumb-nav";
import { LinkButton } from "@/components/ui/link-button";
import { Pagination } from "@/components/ui/pagination";
import { DeleteConfirmButton } from "@/components/delete-confirm-button";
import { deleteProject } from "@/server/actions/projects";
import { PageHeading, EmptyState, StatusBadge } from "@platned/ui";
import type { StatusTone } from "@platned/ui";
import { formatDistanceToNow } from "date-fns";
import { ChartNoAxesColumn, MessageSquareText } from "lucide-react";

const STATUS_TONE: Record<string, StatusTone> = {
  DRAFT: "neutral",
  ACTIVE: "positive",
  COMPLETED: "info",
  ARCHIVED: "neutral",
};

export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ retroPage?: string }>;
}) {
  const { projectId } = await params;
  const { retroPage } = await searchParams;
  let project;
  try {
    project = await getProject(projectId, { retroPage: retroPage ? Number(retroPage) : undefined });
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }
  const session = await auth();
  const currentUserId = session!.user.id;
  const isViewerAdmin =
    session!.user.role === "SUPER_ADMIN" ||
    project.memberships.find((m) => m.userId === currentUserId)?.role === "ADMIN" ||
    (await isCompanyAdmin(currentUserId, project.companyId));
  const addableMembers = await listAddableCompanyMembers(projectId);
  const adminCount = project.memberships.filter((m) => m.role === "ADMIN").length;

  return (
    <div className="flex flex-col gap-8">
      <BreadcrumbNav
        items={[
          { label: project.company.name, href: `/companies/${project.companyId}` },
          { label: project.name },
        ]}
      />

      <PageHeading
        title={project.name}
        subtitle={project.description || undefined}
        actions={
          <div className="flex gap-2">
            {project.retroTotal >= 2 && (
              <LinkButton
                href={`/projects/${project.id}/insights`}
                variant="neutral"
                size="md"
                leadingIcon={<ChartNoAxesColumn className="h-4 w-4" />}
              >
                Insights
              </LinkButton>
            )}
            <InviteMemberDialog
              target="project"
              targetId={project.id}
              targetName={project.name}
              isViewerAdmin={!!isViewerAdmin}
              addableMembers={addableMembers}
            />
            <NewRetroDialog projectId={project.id} />
            {isViewerAdmin && (
              <DeleteConfirmButton
                label="Delete project"
                title="Delete this project?"
                description={`"${project.name}" and all ${project.retroTotal} of its retrospectives will be permanently deleted, along with every card, vote, comment, and action item on them. This can't be undone.`}
                action={deleteProject}
                id={project.id}
                redirectTo={`/companies/${project.companyId}`}
                size="md"
              />
            )}
          </div>
        }
      />

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <h2 className="mb-3 text-heading-sm font-semibold text-default">Retrospectives</h2>
          {project.retroTotal === 0 ? (
            <EmptyState icon={<MessageSquareText className="h-8 w-8" />} message="No retrospectives yet. Start the first one." size="lg" />
          ) : (
            <div className="flex flex-col gap-2">
              {project.retrospectives.map((retro) => (
                <Link
                  key={retro.id}
                  href={`/retros/${retro.id}`}
                  className="flex items-center justify-between rounded-lg border border-default p-4 transition-colors hover:bg-default-secondary"
                >
                  <div className="flex flex-col">
                    <span className="font-medium text-default">{retro.title}</span>
                    <span className="text-body-sm text-default-secondary">
                      Facilitated by {retro.facilitator.name} ·{" "}
                      {formatDistanceToNow(retro.createdAt, { addSuffix: true })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {retro._count.actionItems > 0 && (
                      <StatusBadge
                        label={`${retro._count.actionItems} pending`}
                        tone="warning"
                        size="sm"
                      />
                    )}
                    <StatusBadge label={retro.status} tone={STATUS_TONE[retro.status]} size="sm" />
                  </div>
                </Link>
              ))}
              <Pagination
                basePath={`/projects/${project.id}`}
                params={{ retroPage }}
                pageParam="retroPage"
                page={project.retroPage}
                pageCount={project.retroPageCount}
                label="retrospectives"
              />
            </div>
          )}
        </div>

        <div>
          <h2 className="mb-3 text-heading-sm font-semibold text-default">Members</h2>
          <MembersPanel
            scope="project"
            scopeId={project.id}
            memberships={project.memberships}
            currentUserId={currentUserId}
            isViewerAdmin={!!isViewerAdmin}
            adminCount={adminCount}
          />
        </div>
      </div>
    </div>
  );
}
