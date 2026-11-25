import { auth } from "@/lib/auth";
import { listMyProjects } from "@/server/queries/projects";
import { NewProjectDialog } from "@/components/new-project-dialog";
import { NewCompanyDialog } from "@/components/new-company-dialog";
import { NavLinkText, NavLinkCardArea } from "@/components/mui/nav-link";
import { colorForUser, textColorOn } from "@/lib/userColor";
import { ds } from "@/lib/design";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Avatar from "@mui/material/Avatar";
import Card from "@mui/material/Card";
import FolderIcon from "@mui/icons-material/FolderOpen";
import BusinessIcon from "@mui/icons-material/BusinessOutlined";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export default async function DashboardPage() {
  const session = await auth();
  const isSuperAdmin = session?.user.role === "SUPER_ADMIN";
  const companies = await listMyProjects();
  const projectCount = companies.reduce((sum, c) => sum + c.projects.length, 0);

  return (
    <Stack spacing={{ xs: 5, md: 7 }}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        className="enter"
        sx={{ alignItems: { xs: "stretch", sm: "flex-end" }, justifyContent: "space-between", gap: 3 }}
      >
        <Box>
          <Typography variant="overline" color="text.secondary" component="p" sx={{ mb: 1.5 }}>
            {plural(companies.length, "company")} · {plural(projectCount, "project")}
          </Typography>
          <Typography variant="h3" component="h1">
            Your companies
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mt: 1, maxWidth: "62ch" }}>
            Companies and projects you&apos;re part of. Retrospectives live inside a project.
          </Typography>
        </Box>
        {isSuperAdmin && <NewCompanyDialog />}
      </Stack>

      {companies.length === 0 && (
        <Stack
          spacing={1.5}
          sx={{
            py: 10,
            alignItems: "center",
            textAlign: "center",
            borderRadius: `${ds.r.lg}px`,
            border: 1,
            borderStyle: "dashed",
            borderColor: ds.lineStrong,
            bgcolor: ds.surface,
          }}
        >
          <FolderIcon sx={{ fontSize: 36, color: "text.secondary" }} />
          <Typography variant="body1" color="text.secondary" sx={{ maxWidth: "48ch" }}>
            {isSuperAdmin
              ? "No companies yet. Create the first one to get started."
              : "You haven't been added to any projects yet. Ask an admin to invite you."}
          </Typography>
        </Stack>
      )}

      {companies.map((company) => {
        const companyBg = colorForUser(company.id);
        return (
          <Box component="section" key={company.id} aria-labelledby={`company-${company.id}`}>
            <Stack
              direction="row"
              sx={{
                alignItems: "center",
                justifyContent: "space-between",
                gap: 2,
                pb: 2,
                mb: 2.5,
                borderBottom: 1,
                borderColor: "divider",
                flexWrap: "wrap",
              }}
            >
              <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", minWidth: 0 }}>
                <Avatar variant="rounded" sx={{ width: 36, height: 36, bgcolor: companyBg, color: textColorOn(companyBg) }}>
                  <BusinessIcon fontSize="small" />
                </Avatar>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="h5" component="h2" id={`company-${company.id}`}>
                    <NavLinkText
                      href={`/companies/${company.id}`}
                      variant="inherit"
                      className="arrow-link"
                      sx={{
                        display: "inline-flex",
                        alignItems: "baseline",
                        gap: 1,
                        color: "text.primary",
                        textDecoration: "none",
                      }}
                    >
                      {company.name}
                      <Box component="span" className="arrow" aria-hidden sx={{ fontSize: 18, color: "text.secondary" }}>
                        →
                      </Box>
                    </NavLinkText>
                  </Typography>
                  <Typography variant="caption" color="text.secondary" component="p" sx={{ fontFamily: ds.fontMono }}>
                    {plural(company.projects.length, "project")}
                  </Typography>
                </Box>
              </Stack>
              <NewProjectDialog companyId={company.id} companyName={company.name} />
            </Stack>

            {company.projects.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No projects yet.
              </Typography>
            ) : (
              <Box
                sx={{
                  display: "grid",
                  gap: 2,
                  gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", lg: "repeat(3, minmax(0, 1fr))", xl: "repeat(4, minmax(0, 1fr))" },
                }}
              >
                {company.projects.map((project) => (
                  <Card key={project.id} sx={{ height: "100%" }}>
                    <NavLinkCardArea
                      href={`/projects/${project.id}`}
                      className="arrow-link"
                      sx={{ height: "100%", p: 2.5, display: "flex", flexDirection: "column", alignItems: "stretch", gap: 3 }}
                    >
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="h6" component="h3">
                          {project.name}
                        </Typography>
                        {project.description && (
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{
                              mt: 0.75,
                              display: "-webkit-box",
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: "vertical",
                              overflow: "hidden",
                            }}
                          >
                            {project.description}
                          </Typography>
                        )}
                      </Box>
                      <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between" }}>
                        <Typography variant="caption" sx={{ fontFamily: ds.fontMono, color: "text.secondary" }}>
                          {plural(project._count.retrospectives, "retro")}
                        </Typography>
                        <Box component="span" className="arrow" aria-hidden sx={{ color: "text.primary" }}>
                          →
                        </Box>
                      </Stack>
                    </NavLinkCardArea>
                  </Card>
                ))}
              </Box>
            )}
          </Box>
        );
      })}
    </Stack>
  );
}
