import "server-only";

import { prisma } from "@/lib/prisma";
import {
  requireCompanyMember,
  requireProjectOrCompanyAdmin,
  requireUser,
  ForbiddenError,
} from "@/lib/authz";
import { revalidatePath } from "next/cache";

type CreateProjectInput = {
  name: string;
  description?: string;
  // Exactly one of these must be provided.
  companyId?: string;
  newCompanyName?: string;
};

/**
 * Super Admin: may create a project under an existing company OR define a brand new company.
 * Any existing company member: may create additional projects under a company they belong to.
 */
export async function createProject(input: CreateProjectInput) {
  const user = await requireUser();

  let companyId = input.companyId;

  if (input.newCompanyName) {
    if (user.role !== "SUPER_ADMIN") {
      throw new ForbiddenError("Only a Super Admin can define a new company");
    }
    const company = await prisma.company.create({
      data: { name: input.newCompanyName, createdById: user.id },
    });
    companyId = company.id;
  } else if (companyId) {
    await requireCompanyMember(companyId);
  } else {
    throw new ForbiddenError("Provide either an existing companyId or a newCompanyName");
  }

  const project = await prisma.project.create({
    data: {
      companyId: companyId!,
      name: input.name,
      description: input.description,
      createdById: user.id,
      memberships: { create: { userId: user.id, role: "ADMIN" } },
    },
  });

  // Make sure the creator is also tracked as a company member (Super Admin may not be otherwise).
  await prisma.companyMembership.upsert({
    where: { userId_companyId: { userId: user.id, companyId: companyId! } },
    update: {},
    create: { userId: user.id, companyId: companyId!, role: "ADMIN" },
  });

  revalidatePath("/");
  revalidatePath("/admin");
  return project;
}

/**
 * Project admins, company admins (of the project's company), or Super Admin
 * may permanently delete a project. Deletes every retrospective in it (and
 * everything on those boards) via the DB's cascade rules.
 */
export async function deleteProject(projectId: string) {
  const project = await prisma.project.findUniqueOrThrow({
    where: { id: projectId },
    select: { companyId: true },
  });
  await requireProjectOrCompanyAdmin(projectId, project.companyId);

  await prisma.project.delete({ where: { id: projectId } });
  revalidatePath(`/companies/${project.companyId}`);
  revalidatePath("/");
  revalidatePath("/admin");
}
