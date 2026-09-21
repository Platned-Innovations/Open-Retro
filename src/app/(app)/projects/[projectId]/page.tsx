import { notFound } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import Chip, { type ChipProps } from "@mui/material/Chip";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutlineOutlined";
import BarChartIcon from "@mui/icons-material/BarChart";
import { auth } from "@/lib/auth";
import { isCompanyAdmin, NotFoundError } from "@/lib/authz";
import { getProject } from "@/server/queries/projects";
import { listAddableCompanyMembers } from "@/server/queries/invitations";
import { InviteMemberDialog } from "@/components/invite-member-dialog";
import { NewRetroDialog } from "@/components/new-retro-dialog";
import { MembersPanel } from "@/components/members-panel";
import { BreadcrumbNav } from "@/components/breadcrumb-nav";
import { NavLinkButton, NavLinkCardArea } from "@/components/mui/nav-link";
import { Pagination } from "@/components/ui/pagination";
import { DeleteConfirmButton } from "@/components/delete-confirm-button";
import { deleteProject } from "@/server/actions/projects";

const STATUS_CHIP_COLOR: Record<string, ChipProps["color"]> = {
  DRAFT: "default",
  ACTIVE: "success",
  COMPLETED: "info",
  ARCHIVED: "default",
};

const STATUS_BORDER_COLOR: Record<string, string> = {
  DRAFT: "grey.400",
  ACTIVE: "success.main",
  COMPLETED: "info.main",
  ARCHIVED: "grey.400",
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
    <Stack spacing={4}>
      <BreadcrumbNav items={[{ label: project.company.name, href: `/companies/${project.companyId}` }, { label: project.name }]} />

      <Stack direction="row" sx={{ alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 2 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            {project.name}
          </Typography>
          {project.description && (
            <Typography variant="body1" color="text.secondary">
              {project.description}
            </Typography>
          )}
        </Box>
        <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
          {project.retroTotal >= 2 && (
            <NavLinkButton href={`/projects/${project.id}/insights`} variant="outlined" size="small" startIcon={<BarChartIcon fontSize="small" />}>
              Insights
            </NavLinkButton>
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
              size="medium"
            />
          )}
        </Stack>
      </Stack>

      <Grid container spacing={4}>
        <Grid size={{ xs: 12, lg: 8 }}>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 1.5 }}>
            Retrospectives
          </Typography>
          {project.retroTotal === 0 ? (
            <Stack spacing={1.5} sx={{ py: 6, alignItems: "center", color: "text.secondary" }}>
              <ChatBubbleOutlineIcon sx={{ fontSize: 36, opacity: 0.5 }} />
              <Typography variant="body2" color="text.secondary">
                No retrospectives yet. Start the first one.
              </Typography>
            </Stack>
          ) : (
            <Stack spacing={2}>
              <Stack spacing={1.5}>
                {project.retrospectives.map((retro) => (
                  <Card
                    key={retro.id}
                    variant="outlined"
                    sx={{ borderLeft: 4, borderLeftColor: STATUS_BORDER_COLOR[retro.status] ?? "grey.400" }}
                  >
                    <NavLinkCardArea href={`/retros/${retro.id}`} sx={{ p: 2 }}>
                      <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 1.5 }}>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="body1" sx={{ fontWeight: 600 }}>
                            {retro.title}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Facilitated by {retro.facilitator.name} · {formatDistanceToNow(retro.createdAt, { addSuffix: true })}
                          </Typography>
                        </Box>
                        <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
                          {retro._count.actionItems > 0 && (
                            <Chip label={`${retro._count.actionItems} pending`} color="warning" size="small" variant="outlined" />
                          )}
                          <Chip label={retro.status} color={STATUS_CHIP_COLOR[retro.status]} size="small" />
                        </Stack>
                      </Stack>
                    </NavLinkCardArea>
                  </Card>
                ))}
              </Stack>
              <Pagination
                basePath={`/projects/${project.id}`}
                params={{ retroPage }}
                pageParam="retroPage"
                page={project.retroPage}
                pageCount={project.retroPageCount}
                label="retrospectives"
              />
            </Stack>
          )}
        </Grid>

        <Grid size={{ xs: 12, lg: 4 }}>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 1.5 }}>
            Members
          </Typography>
          <MembersPanel
            scope="project"
            scopeId={project.id}
            memberships={project.memberships}
            currentUserId={currentUserId}
            isViewerAdmin={!!isViewerAdmin}
            adminCount={adminCount}
          />
        </Grid>
      </Grid>
    </Stack>
  );
}
