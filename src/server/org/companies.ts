import "server-only";

import { prisma } from "@/lib/prisma";
import { requireCompanyAdmin, requireSuperAdmin } from "@/lib/authz";
import { revalidatePath } from "next/cache";
import { parse } from "@/server/validation/parse";
import { setCompanyAiFeaturesInput } from "@/server/validation/companies";

/** Super Admin only: companies are created implicitly when creating the first project for them. */
export async function createCompany(name: string) {
  const user = await requireSuperAdmin();
  const company = await prisma.company.create({
    data: {
      name,
      createdById: user.id,
      memberships: { create: { userId: user.id, role: "ADMIN" } },
    },
  });
  revalidatePath("/admin");
  return company;
}

/**
 * Super Admin only. Permanently deletes a company along with every project
 * in it, and every retrospective in those projects (cascades at the DB
 * level — see the onDelete: Cascade chain in schema.prisma).
 */
export async function deleteCompany(companyId: string) {
  await requireSuperAdmin();
  await prisma.company.delete({ where: { id: companyId } });
  revalidatePath("/");
  revalidatePath("/admin");
}

/**
 * Turns AI features on or off for a company.
 *
 * Company admins, not Super Admin only: the decision is whether this
 * company's candid retrospective content may be sent to a model provider,
 * and that belongs to the people whose content it is. (A platform admin
 * passes requireCompanyAdmin anyway, as they do everywhere else — what they
 * cannot do is bypass the resulting flag. See requireCompanyAiEnabled.)
 */
export async function setCompanyAiFeatures(rawInput: {
  companyId: string;
  enabled: boolean;
}) {
  const input = parse(setCompanyAiFeaturesInput, rawInput);
  await requireCompanyAdmin(input.companyId);

  await prisma.company.update({
    where: { id: input.companyId },
    data: { aiFeaturesEnabled: input.enabled },
  });
  revalidatePath(`/companies/${input.companyId}`);
}
