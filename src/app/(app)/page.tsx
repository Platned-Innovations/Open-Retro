import { auth } from "@/lib/auth";
import { listMyProjects } from "@/server/queries/projects";
import { NewProjectDialog } from "@/components/new-project-dialog";
import { NewCompanyDialog } from "@/components/new-company-dialog";
import { NavLinkText, NavLinkCardArea } from "@/components/mui/nav-link";
import { colorForUser, textColorOn } from "@/lib/userColor";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Avatar from "@mui/material/Avatar";
import Card from "@mui/material/Card";
import CardHeader from "@mui/material/CardHeader";
import CardContent from "@mui/material/CardContent";
import Grid from "@mui/material/Grid";
import Chip from "@mui/material/Chip";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import FolderIcon from "@mui/icons-material/FolderOpen";
import ForumIcon from "@mui/icons-material/ForumOutlined";
import BusinessIcon from "@mui/icons-material/BusinessOutlined";

export default async function DashboardPage() {
  const session = await auth();
  const isSuperAdmin = session?.user.role === "SUPER_ADMIN";
  const companies = await listMyProjects();

  return (
    <Stack spacing={4}>
      <Stack direction="row" sx={{ alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 2 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            Your companies
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Companies and projects you&apos;re part of. Retrospectives live inside a project.
          </Typography>
        </Box>
        {isSuperAdmin && <NewCompanyDialog />}
      </Stack>

      {companies.length === 0 && (
        <Stack spacing={1.5} sx={{ py: 8, alignItems: "center", color: "text.secondary" }}>
          <FolderIcon sx={{ fontSize: 40, opacity: 0.5 }} />
          <Typography variant="body1" color="text.secondary">
            {isSuperAdmin
              ? "No companies yet. Create the first one to get started."
              : "You haven't been added to any projects yet. Ask an admin to invite you."}
          </Typography>
        </Stack>
      )}

      <Stack spacing={3}>
        {companies.map((company) => {
          const companyBg = colorForUser(company.id);
          return (
          <Card key={company.id} variant="outlined" sx={{ borderTop: 3, borderTopColor: "primary.main" }}>
            <CardHeader
              avatar={
                <Avatar variant="rounded" sx={{ width: 36, height: 36, bgcolor: companyBg, color: textColorOn(companyBg) }}>
                  <BusinessIcon fontSize="small" />
                </Avatar>
              }
              title={
                <NavLinkText
                  href={`/companies/${company.id}`}
                  variant="h6"
                  sx={{
                    fontWeight: 600,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 0.5,
                    textDecoration: "none",
                    color: "text.primary",
                    "&:hover": { color: "primary.main" },
                  }}
                >
                  {company.name}
                  <ChevronRightIcon fontSize="small" />
                </NavLinkText>
              }
              subheader={`${company.projects.length} project${company.projects.length === 1 ? "" : "s"}`}
              action={<NewProjectDialog companyId={company.id} companyName={company.name} />}
            />
            <CardContent>
              {company.projects.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No projects yet.
                </Typography>
              ) : (
                <Grid container spacing={2}>
                  {company.projects.map((project) => (
                    <Grid key={project.id} size={{ xs: 12, sm: 6, lg: 4 }}>
                      <Card variant="outlined" sx={{ height: "100%" }}>
                        <NavLinkCardArea href={`/projects/${project.id}`} sx={{ height: "100%", p: 2 }}>
                          <Stack spacing={1}>
                            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                              {project.name}
                            </Typography>
                            {project.description && (
                              <Typography
                                variant="body2"
                                color="text.secondary"
                                sx={{
                                  display: "-webkit-box",
                                  WebkitLineClamp: 2,
                                  WebkitBoxOrient: "vertical",
                                  overflow: "hidden",
                                }}
                              >
                                {project.description}
                              </Typography>
                            )}
                            <Chip
                              icon={<ForumIcon />}
                              label={`${project._count.retrospectives} retro${project._count.retrospectives === 1 ? "" : "s"}`}
                              size="small"
                              color="primary"
                              variant="outlined"
                              sx={{ width: "fit-content" }}
                            />
                          </Stack>
                        </NavLinkCardArea>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              )}
            </CardContent>
          </Card>
          );
        })}
      </Stack>
    </Stack>
  );
}
