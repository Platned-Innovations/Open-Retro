import { notFound } from "next/navigation";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
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
import { NavLinkCardArea } from "@/components/mui/nav-link";

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
    isSuperAdmin || company.memberships.find((m) => m.userId === session!.user.id)?.role === "ADMIN";
  const adminCount = company.memberships.filter((m) => m.role === "ADMIN").length;

  return (
    <Stack spacing={4}>
      <BreadcrumbNav items={[{ label: company.name }]} />

      <Stack direction="row" sx={{ alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 2 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            {company.name}
          </Typography>
          <Typography variant="body1" color="text.secondary">
            {company.projects.length} project{company.projects.length === 1 ? "" : "s"} ·{" "}
            {company.memberships.length} member{company.memberships.length === 1 ? "" : "s"}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <InviteMemberDialog target="company" targetId={company.id} targetName={company.name} isViewerAdmin={!!isCompanyAdmin} />
          <NewProjectDialog companyId={company.id} companyName={company.name} />
          {isSuperAdmin && (
            <DeleteConfirmButton
              label="Delete company"
              title="Delete this company?"
              description={`"${company.name}" and all ${company.projects.length} of its projects will be permanently deleted, along with every retrospective in them. This can't be undone.`}
              action={deleteCompany}
              id={company.id}
              redirectTo="/"
            />
          )}
        </Stack>
      </Stack>

      <Grid container spacing={4}>
        <Grid size={{ xs: 12, lg: 8 }}>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 1.5 }}>
            Projects
          </Typography>
          {company.projects.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              {isCompanyAdmin ? "No projects yet." : "You haven't been added to a project yet — ask an admin to add you to one."}
            </Typography>
          ) : (
            <Grid container spacing={2}>
              {company.projects.map((project) => (
                <Grid key={project.id} size={{ xs: 12, sm: 6 }}>
                  <Card variant="outlined">
                    <NavLinkCardArea href={`/projects/${project.id}`} sx={{ p: 2 }}>
                      <Stack spacing={0.5}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                          {project.name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {project._count.memberships} member{project._count.memberships === 1 ? "" : "s"}
                        </Typography>
                      </Stack>
                    </NavLinkCardArea>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </Grid>

        <Grid size={{ xs: 12, lg: 4 }}>
          <Stack spacing={4}>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 1.5 }}>
                Settings
              </Typography>
              <CompanyAiToggle companyId={company.id} enabled={company.aiFeaturesEnabled} canEdit={!!isCompanyAdmin} />
            </Box>

            <Box>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 1.5 }}>
                Members
              </Typography>
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
            </Box>
          </Stack>
        </Grid>
      </Grid>
    </Stack>
  );
}
