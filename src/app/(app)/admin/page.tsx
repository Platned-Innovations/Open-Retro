import { format } from "date-fns";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Grid from "@mui/material/Grid";
import Paper from "@mui/material/Paper";
import Chip from "@mui/material/Chip";
import TableContainer from "@mui/material/TableContainer";
import Table from "@mui/material/Table";
import TableHead from "@mui/material/TableHead";
import TableBody from "@mui/material/TableBody";
import TableRow from "@mui/material/TableRow";
import TableCell from "@mui/material/TableCell";
import { listAllUsers, listCompaniesAndProjectsForFilters } from "@/server/queries/users";
import { listCompanies } from "@/server/queries/companies";
import { AdminFilters } from "@/components/admin-filters";
import { Pagination } from "@/components/ui/pagination";
import { AdminUserActions } from "@/components/admin-user-actions";

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <Paper variant="outlined" sx={{ p: 2.5 }}>
      <Typography variant="h3" sx={{ fontWeight: 700 }}>
        {value}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
    </Paper>
  );
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ companyId?: string; projectId?: string; page?: string }>;
}) {
  const { companyId, projectId, page } = await searchParams;
  const [userPage, filterOptions, companies] = await Promise.all([
    listAllUsers({ companyId, projectId, page: page ? Number(page) : undefined }),
    listCompaniesAndProjectsForFilters(),
    listCompanies(),
  ]);

  return (
    <Stack spacing={4}>
      <Box>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          Platform admin
        </Typography>
        <Typography variant="body1" color="text.secondary">
          All users, companies, and projects across Agile Retro.
        </Typography>
      </Box>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 4 }}>
          <StatTile label="Companies" value={companies.length} />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <StatTile label="Projects" value={companies.reduce((sum, c) => sum + c._count.projects, 0)} />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <StatTile label="Users" value={userPage.total} />
        </Grid>
      </Grid>

      <Stack spacing={2}>
        <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Users
          </Typography>
          <AdminFilters companies={filterOptions} />
        </Stack>

        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Role</TableCell>
                <TableCell>Companies</TableCell>
                <TableCell>Projects</TableCell>
                <TableCell>Joined</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {userPage.users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 4, color: "text.secondary" }}>
                    No users match this filter.
                  </TableCell>
                </TableRow>
              ) : (
                userPage.users.map((u) => (
                  <TableRow key={u.id} hover>
                    <TableCell sx={{ fontWeight: 500 }} title={u.name}>
                      {u.name}
                    </TableCell>
                    <TableCell sx={{ color: "text.secondary" }}>{u.email}</TableCell>
                    <TableCell>
                      <Chip
                        label={u.role === "SUPER_ADMIN" ? "Super Admin" : "User"}
                        color={u.role === "SUPER_ADMIN" ? "primary" : "default"}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={0.5} sx={{ flexWrap: "wrap", gap: 0.5 }}>
                        {u.companyMemberships.map((m) => (
                          <Chip
                            key={m.id}
                            label={m.role === "ADMIN" ? `${m.company.name} · Admin` : m.company.name}
                            color={m.role === "ADMIN" ? "primary" : "default"}
                            variant="outlined"
                            size="small"
                          />
                        ))}
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={0.5} sx={{ flexWrap: "wrap", gap: 0.5 }}>
                        {u.projectMemberships.map((m) => (
                          <Chip
                            key={m.id}
                            label={m.role === "ADMIN" ? `${m.project.name} · Admin` : m.project.name}
                            color={m.role === "ADMIN" ? "primary" : "default"}
                            variant="outlined"
                            size="small"
                          />
                        ))}
                      </Stack>
                    </TableCell>
                    <TableCell sx={{ color: "text.secondary" }}>{format(u.createdAt, "MMM d, yyyy")}</TableCell>
                    <TableCell align="right">
                      <AdminUserActions
                        userId={u.id}
                        userName={u.name}
                        role={u.role}
                        companies={filterOptions}
                        currentProjects={u.projectMemberships.map((m) => ({
                          id: m.project.id,
                          name: m.project.name,
                          companyName: m.project.company.name,
                        }))}
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        <Pagination
          basePath="/admin"
          params={{ companyId, projectId, page }}
          page={userPage.page}
          pageCount={userPage.pageCount}
          label="users"
        />
      </Stack>
    </Stack>
  );
}
