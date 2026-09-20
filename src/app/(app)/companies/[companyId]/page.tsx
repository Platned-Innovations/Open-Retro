import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { NotFoundError } from "@/lib/authz";
import { getCompany } from "@/server/queries/companies";
import { deleteCompany } from "@/server/actions/companies";
import { NewProjectDialog } from "@/components/new-project-dialog";
import { InviteMemberDialog } from "@/components/invite-member-dialog";
import { MembersPanel } from "@/components/members-panel";
import { CompanyAiToggle } from "@/components/company-ai-toggle";
import { BreadcrumbNav } from "@/components/breadcrumb-nav";
import { DeleteConfirmButton } from "@/components/delete-confirm-button";
import { PageHeading } from "@platned/ui";

export default async function CompanyPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;
  let company;
  try {
    company = await getCompany(companyId);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }
  const session = await auth();
  const isSuperAdmin = session!.user.role === "SUPER_ADMIN";
  const isCompanyAdmin =
    isSuperAdmin ||
    company.memberships.find((m) => m.userId === session!.user.id)?.role === "ADMIN";
  const adminCount = company.memberships.filter((m) => m.role === "ADMIN").length;

  return (
    <div className="flex flex-col gap-8">
      <BreadcrumbNav items={[{ label: company.name }]} />

      <PageHeading
        title={company.name}
        subtitle={`${company.projects.length} project${company.projects.length === 1 ? "" : "s"} · ${company.memberships.length} member${company.memberships.length === 1 ? "" : "s"}`}
        actions={
          <div className="flex gap-2">
            <InviteMemberDialog
              target="company"
              targetId={company.id}
              targetName={company.name}
              isViewerAdmin={!!isCompanyAdmin}
            />
            <NewProjectDialog companyId={company.id} companyName={company.name} />
            {isSuperAdmin && (
              <DeleteConfirmButton
                label="Delete company"
                title="Delete this company?"
                description={`"${company.name}" and all ${company.projects.length} of its projects will be permanently deleted, along with every retrospective in them. This can't be undone.`}
                action={deleteCompany}
                id={company.id}
                redirectTo="/"
                size="md"
              />
            )}
          </div>
        }
      />

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <h2 className="mb-3 text-heading-sm font-semibold text-default">Projects</h2>
          {company.projects.length === 0 ? (
            <p className="text-body-sm text-default-secondary">
              {isCompanyAdmin
                ? "No projects yet."
                : "You haven't been added to a project yet — ask an admin to add you to one."}
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {company.projects.map((project) => (
                <Link
                  key={project.id}
                  href={`/projects/${project.id}`}
                  className="flex flex-col gap-1 rounded-lg border border-default p-4 transition-colors hover:bg-default-secondary"
                >
                  <span className="font-medium text-default">{project.name}</span>
                  <span className="text-body-sm text-default-secondary">
                    {project._count.memberships} member{project._count.memberships === 1 ? "" : "s"}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-8">
          <div>
            <h2 className="mb-3 text-heading-sm font-semibold text-default">Settings</h2>
            <CompanyAiToggle
              companyId={company.id}
              enabled={company.aiFeaturesEnabled}
              canEdit={!!isCompanyAdmin}
            />
          </div>

          <div>
            <h2 className="mb-3 text-heading-sm font-semibold text-default">Members</h2>
            <MembersPanel
              scope="company"
              scopeId={company.id}
              memberships={company.memberships.map((m) => ({
                ...m,
                projects: m.user.projectMemberships.map((pm) => pm.project),
              }))}
              currentUserId={session!.user.id}
              isViewerAdmin={!!isCompanyAdmin}
              adminCount={adminCount}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
