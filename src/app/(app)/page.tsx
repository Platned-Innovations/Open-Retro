import Link from "next/link";
import { auth } from "@/lib/auth";
import { listMyProjects } from "@/server/queries/projects";
import { NewProjectDialog } from "@/components/new-project-dialog";
import { NewCompanyDialog } from "@/components/new-company-dialog";
import { PageHeading, Card, CardHeader, CardTitle, CardAction, CardBody, EmptyState, StatusBadge } from "@platned/ui";
import { ChevronRight, FolderKanban, MessageSquareText } from "lucide-react";

export default async function DashboardPage() {
  const session = await auth();
  const isSuperAdmin = session?.user.role === "SUPER_ADMIN";
  const companies = await listMyProjects();

  return (
    <div className="flex flex-col gap-8">
      <PageHeading
        title="Your companies"
        subtitle="Companies and projects you're part of. Retrospectives live inside a project."
        actions={isSuperAdmin ? <NewCompanyDialog /> : undefined}
      />

      {companies.length === 0 && (
        <EmptyState
          icon={<FolderKanban className="h-8 w-8" />}
          message={
            isSuperAdmin
              ? "No companies yet. Create the first one to get started."
              : "You haven't been added to any projects yet. Ask an admin to invite you."
          }
          size="lg"
        />
      )}

      <div className="flex flex-col gap-6">
        {companies.map((company) => (
          <Card key={company.id}>
            <CardHeader>
              <CardTitle as="h2">
                <Link href={`/companies/${company.id}`} className="inline-flex items-center gap-1 hover:text-brand">
                  {company.name}
                  <ChevronRight className="size-4" />
                </Link>
              </CardTitle>
              <CardAction>
                <NewProjectDialog companyId={company.id} companyName={company.name} />
              </CardAction>
            </CardHeader>
            <CardBody>
              {company.projects.length === 0 ? (
                <p className="text-body-sm text-default-secondary">No projects yet.</p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {company.projects.map((project) => (
                    <Link
                      key={project.id}
                      href={`/projects/${project.id}`}
                      className="flex flex-col gap-2 rounded-lg border border-default p-4 transition-colors hover:bg-default-secondary"
                    >
                      <span className="font-medium text-default">{project.name}</span>
                      {project.description && (
                        <span className="line-clamp-2 text-body-sm text-default-secondary">
                          {project.description}
                        </span>
                      )}
                      <StatusBadge
                        tone="neutral"
                        dot={false}
                        icon={<MessageSquareText className="h-3 w-3" />}
                        label={`${project._count.retrospectives} retro${project._count.retrospectives === 1 ? "" : "s"}`}
                        className="w-fit"
                      />
                    </Link>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
}
