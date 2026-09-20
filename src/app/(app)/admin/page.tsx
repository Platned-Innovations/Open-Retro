import { listAllUsers, listCompaniesAndProjectsForFilters } from "@/server/queries/users";
import { listCompanies } from "@/server/queries/companies";
import { AdminFilters } from "@/components/admin-filters";
import { Pagination } from "@/components/ui/pagination";
import { AdminUserActions } from "@/components/admin-user-actions";
import { PageHeading, TileGrid, StatTile, RoleBadge, Badge, Card, DataTable } from "@platned/ui";
import { format } from "date-fns";

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
    <div className="flex flex-col gap-8">
      <PageHeading title="Platform admin" subtitle="All users, companies, and projects across Agile Retro." />

      <TileGrid columns={3}>
        <StatTile label="Companies" value={companies.length} />
        <StatTile label="Projects" value={companies.reduce((sum, c) => sum + c._count.projects, 0)} />
        <StatTile label="Users" value={userPage.total} />
      </TileGrid>

      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-heading-sm font-semibold text-default">Users</h2>
          <AdminFilters companies={filterOptions} />
        </div>

        <Card>
          <DataTable
            columns={[
              {
                key: "name",
                header: "Name",
                width: "160px",
                render: (u) => (
                  <span className="block truncate font-medium" title={u.name}>
                    {u.name}
                  </span>
                ),
              },
              { key: "email", header: "Email", width: "220px", grow: true, render: (u) => <span className="text-default-secondary">{u.email}</span> },
              {
                key: "role",
                header: "Role",
                width: "120px",
                render: (u) => <RoleBadge role={u.role === "SUPER_ADMIN" ? "Super Admin" : "User"} size="sm" />,
              },
              {
                key: "companies",
                header: "Companies",
                width: "200px",
                render: (u) => (
                  <div className="flex flex-wrap gap-1">
                    {u.companyMemberships.map((m) => (
                      <Badge
                        key={m.id}
                        label={m.role === "ADMIN" ? `${m.company.name} · Admin` : m.company.name}
                        color={m.role === "ADMIN" ? "blue" : "gray"}
                        size="sm"
                      />
                    ))}
                  </div>
                ),
              },
              {
                key: "projects",
                header: "Projects",
                width: "200px",
                render: (u) => (
                  <div className="flex flex-wrap gap-1">
                    {u.projectMemberships.map((m) => (
                      <Badge
                        key={m.id}
                        label={m.role === "ADMIN" ? `${m.project.name} · Admin` : m.project.name}
                        color={m.role === "ADMIN" ? "blue" : "gray"}
                        size="sm"
                      />
                    ))}
                  </div>
                ),
              },
              {
                key: "joined",
                header: "Joined",
                width: "120px",
                render: (u) => <span className="text-default-secondary">{format(u.createdAt, "MMM d, yyyy")}</span>,
              },
              {
                key: "actions",
                header: "",
                width: "100px",
                render: (u) => (
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
                ),
              },
            ]}
            rows={userPage.users}
            getRowKey={(u) => u.id}
            emptyLabel="No users match this filter."
          />
        </Card>

        <Pagination
          basePath="/admin"
          params={{ companyId, projectId, page }}
          page={userPage.page}
          pageCount={userPage.pageCount}
          label="users"
        />
      </div>
    </div>
  );
}
