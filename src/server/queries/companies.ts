import "server-only";

import { prisma } from "@/lib/prisma";
import { requireSuperAdmin, requireCompanyMember, NotFoundError } from "@/lib/authz";
import { USER_DIRECTORY_SELECT } from "@/server/user-select";

export async function listCompanies() {
  await requireSuperAdmin();
  return prisma.company.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: { select: { projects: true, memberships: true } },
    },
  });
}

export async function getCompany(companyId: string) {
  const user = await requireCompanyMember(companyId);

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    include: {
      projects: { orderBy: { name: "asc" }, include: { _count: { select: { memberships: true } } } },
      memberships: {
        select: {
          id: true,
          role: true,
          userId: true,
          user: {
            select: {
              ...USER_DIRECTORY_SELECT.select,
              projectMemberships: {
                where: { project: { companyId } },
                select: { project: { select: { id: true, name: true } } },
              },
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  // Super Admin bypasses the membership check above, so this is the only
  // place a since-deleted company would otherwise surface at all.
  if (!company) throw new NotFoundError("Company not found");

  const isCompanyAdmin =
    user.role === "SUPER_ADMIN" ||
    company.memberships.find((m) => m.userId === user.id)?.role === "ADMIN";
  if (isCompanyAdmin) return company;

  // A plain member only sees the projects they've actually been invited to,
  // not every sibling project in the company.
  const myProjectMemberships = await prisma.projectMembership.findMany({
    where: { userId: user.id, project: { companyId } },
    select: { projectId: true },
  });
  const visibleProjectIds = new Set(myProjectMemberships.map((m) => m.projectId));

  return {
    ...company,
    projects: company.projects.filter((p) => visibleProjectIds.has(p.id)),
  };
}
