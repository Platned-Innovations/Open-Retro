import "server-only";

import { prisma } from "@/lib/prisma";
import {
  requireProjectMember,
  requireCompanyMember,
  requireCompanyAdmin,
  isCompanyAdmin,
  ForbiddenError,
  NotFoundError,
} from "@/lib/authz";
import { generateRawToken, hashToken, LOGIN_TOKEN_TTL_MS } from "@/lib/tokens";
import { sendMail } from "@/lib/email/graphMailer";
import { invitationEmail, addedToProjectEmail } from "@/lib/email/templates";
import { revalidatePath } from "next/cache";
import type { MembershipRole } from "@/generated/prisma/client";
import { rateLimit } from "@/lib/rateLimit";
import { parse } from "@/server/validation/parse";
import {
  inviteToCompanyInput,
  inviteToProjectInput,
  memberNameInput,
} from "@/server/validation/invitations";

/**
 * Any project member may invite, the dialog accepts a whole textarea of
 * addresses, and each one sends mail through the company's Graph sender and
 * creates a User row. Unlike the login-link limit this refusal is visible: the
 * caller is signed in and there is no enumeration signal to protect, so telling
 * them plainly is better than silently dropping invitations they believe went out.
 */
function assertInviteQuota(inviterId: string) {
  const result = rateLimit(`invite:${inviterId}`, { limit: 50, windowMs: 60 * 60_000 });
  if (!result.ok) {
    throw new ForbiddenError(
      "That's a lot of invitations at once — wait a little while before sending more",
    );
  }
}

async function findOrCreateInvitedUser(email: string) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return existing;
  return prisma.user.create({
    data: { email, name: email.split("@")[0], role: "USER" },
  });
}

/**
 * Any existing member of a project may invite someone new to it (per spec),
 * but only as a plain Member — inviting someone as Admin, or changing an
 * existing member's role at all (including their own), requires being a
 * project admin (or Super Admin).
 */
export async function inviteUserToProject(rawInput: {
  projectId: string;
  email: string;
  role?: MembershipRole;
}) {
  const input = parse(inviteToProjectInput, rawInput);
  const inviter = await requireProjectMember(input.projectId);
  assertInviteQuota(inviter.id);
  const email = input.email;
  const requestedRole = input.role ?? "MEMBER";

  const project = await prisma.project.findUniqueOrThrow({
    where: { id: input.projectId },
    include: { company: true },
  });

  let inviterIsAdmin = inviter.role === "SUPER_ADMIN";
  if (!inviterIsAdmin) {
    const inviterMembership = await prisma.projectMembership.findUnique({
      where: { userId_projectId: { userId: inviter.id, projectId: project.id } },
    });
    inviterIsAdmin =
      inviterMembership?.role === "ADMIN" || (await isCompanyAdmin(inviter.id, project.companyId));
  }

  if (requestedRole === "ADMIN" && !inviterIsAdmin) {
    throw new ForbiddenError("Only a project admin can invite someone as an admin");
  }

  const invitedUser = await findOrCreateInvitedUser(email);

  const existingMembership = await prisma.projectMembership.findUnique({
    where: { userId_projectId: { userId: invitedUser.id, projectId: project.id } },
  });
  if (existingMembership && !inviterIsAdmin) {
    throw new ForbiddenError(
      "This person is already on the project — ask a project admin to change their role",
    );
  }

  await prisma.projectMembership.upsert({
    where: { userId_projectId: { userId: invitedUser.id, projectId: project.id } },
    update: { role: requestedRole },
    create: { userId: invitedUser.id, projectId: project.id, role: requestedRole },
  });

  await prisma.companyMembership.upsert({
    where: { userId_companyId: { userId: invitedUser.id, companyId: project.companyId } },
    update: {},
    create: { userId: invitedUser.id, companyId: project.companyId, role: "MEMBER" },
  });

  const rawToken = generateRawToken();
  const expiresAt = new Date(Date.now() + LOGIN_TOKEN_TTL_MS);
  await prisma.loginToken.create({
    data: { userId: invitedUser.id, tokenHash: hashToken(rawToken), expiresAt },
  });
  await prisma.invitation.create({
    data: {
      email,
      projectId: project.id,
      companyId: project.companyId,
      role: requestedRole,
      invitedById: inviter.id,
      expiresAt,
    },
  });

  const url = `${process.env.APP_URL}/auth/verify?token=${rawToken}`;
  const { subject, html } = invitationEmail({
    url,
    inviterName: inviter.name,
    projectName: project.name,
  });
  await sendMail({ to: email, subject, html }).catch((err) => {
    console.error("Failed to send invitation email:", err);
  });

  revalidatePath(`/projects/${project.id}`);
  return { userId: invitedUser.id };
}

/**
 * Adds a user who's already a member of the project's company straight onto
 * the project — no new invitation/login token, since they can already sign
 * in. Same role rules as inviteUserToProject: only an admin may add someone
 * as Admin, or change an existing member's role.
 */
export async function addExistingMemberToProject(input: {
  projectId: string;
  userId: string;
  role?: MembershipRole;
}) {
  const actor = await requireProjectMember(input.projectId);
  const requestedRole = input.role ?? "MEMBER";

  const project = await prisma.project.findUniqueOrThrow({ where: { id: input.projectId } });

  let actorIsAdmin = actor.role === "SUPER_ADMIN";
  if (!actorIsAdmin) {
    const actorMembership = await prisma.projectMembership.findUnique({
      where: { userId_projectId: { userId: actor.id, projectId: project.id } },
    });
    actorIsAdmin =
      actorMembership?.role === "ADMIN" || (await isCompanyAdmin(actor.id, project.companyId));
  }
  if (requestedRole === "ADMIN" && !actorIsAdmin) {
    throw new ForbiddenError("Only a project admin can add someone as an admin");
  }

  const targetCompanyMembership = await prisma.companyMembership.findUnique({
    where: { userId_companyId: { userId: input.userId, companyId: project.companyId } },
  });
  if (!targetCompanyMembership) {
    throw new ForbiddenError("This person isn't a member of the company yet — invite them by email instead");
  }

  const existingMembership = await prisma.projectMembership.findUnique({
    where: { userId_projectId: { userId: input.userId, projectId: project.id } },
  });
  if (existingMembership && !actorIsAdmin) {
    throw new ForbiddenError(
      "This person is already on the project — ask a project admin to change their role",
    );
  }

  await prisma.projectMembership.upsert({
    where: { userId_projectId: { userId: input.userId, projectId: project.id } },
    update: { role: requestedRole },
    create: { userId: input.userId, projectId: project.id, role: requestedRole },
  });

  const targetUser = await prisma.user.findUniqueOrThrow({ where: { id: input.userId } });
  const url = `${process.env.APP_URL}/projects/${project.id}`;
  const { subject, html } = addedToProjectEmail({ url, actorName: actor.name, projectName: project.name });
  await sendMail({ to: targetUser.email, subject, html }).catch((err) => {
    console.error("Failed to send 'added to project' email:", err);
  });

  revalidatePath(`/projects/${project.id}`);
}

/**
 * Any company member may invite someone new, but only as a plain Member —
 * inviting as Admin, or changing an existing member's role at all
 * (including their own), requires being a company admin (or Super Admin).
 */
export async function inviteUserToCompany(rawInput: {
  companyId: string;
  email: string;
  role?: MembershipRole;
}) {
  const input = parse(inviteToCompanyInput, rawInput);
  const inviter = await requireCompanyMember(input.companyId);
  assertInviteQuota(inviter.id);
  const email = input.email;
  const requestedRole = input.role ?? "MEMBER";

  const company = await prisma.company.findUniqueOrThrow({ where: { id: input.companyId } });

  let inviterIsAdmin = inviter.role === "SUPER_ADMIN";
  if (!inviterIsAdmin) {
    const inviterMembership = await prisma.companyMembership.findUnique({
      where: { userId_companyId: { userId: inviter.id, companyId: company.id } },
    });
    inviterIsAdmin = inviterMembership?.role === "ADMIN";
  }

  if (requestedRole === "ADMIN" && !inviterIsAdmin) {
    throw new ForbiddenError("Only a company admin can invite someone as an admin");
  }

  const invitedUser = await findOrCreateInvitedUser(email);

  const existingMembership = await prisma.companyMembership.findUnique({
    where: { userId_companyId: { userId: invitedUser.id, companyId: company.id } },
  });
  if (existingMembership && !inviterIsAdmin) {
    throw new ForbiddenError(
      "This person is already in the company — ask a company admin to change their role",
    );
  }

  await prisma.companyMembership.upsert({
    where: { userId_companyId: { userId: invitedUser.id, companyId: company.id } },
    update: { role: requestedRole },
    create: { userId: invitedUser.id, companyId: company.id, role: requestedRole },
  });

  const rawToken = generateRawToken();
  const expiresAt = new Date(Date.now() + LOGIN_TOKEN_TTL_MS);
  await prisma.loginToken.create({
    data: { userId: invitedUser.id, tokenHash: hashToken(rawToken), expiresAt },
  });
  await prisma.invitation.create({
    data: { email, companyId: company.id, role: requestedRole, invitedById: inviter.id, expiresAt },
  });

  const url = `${process.env.APP_URL}/auth/verify?token=${rawToken}`;
  const { subject, html } = invitationEmail({ url, inviterName: inviter.name, companyName: company.name });
  await sendMail({ to: email, subject, html }).catch((err) => {
    console.error("Failed to send invitation email:", err);
  });

  revalidatePath(`/companies/${company.id}`);
  return { userId: invitedUser.id };
}

/**
 * Any project member may remove another plain member. Removing an admin, or
 * removing yourself, requires being an admin (or Super Admin) — a regular
 * member can only ever remove other regular members.
 */
export async function removeProjectMember(projectId: string, userId: string) {
  const actor = await requireProjectMember(projectId);

  if (actor.role !== "SUPER_ADMIN") {
    const [actorMembership, project] = await Promise.all([
      prisma.projectMembership.findUnique({
        where: { userId_projectId: { userId: actor.id, projectId } },
      }),
      prisma.project.findUniqueOrThrow({ where: { id: projectId }, select: { companyId: true } }),
    ]);
    const actorIsAdmin =
      actorMembership?.role === "ADMIN" || (await isCompanyAdmin(actor.id, project.companyId));

    if (!actorIsAdmin) {
      if (userId === actor.id) {
        throw new ForbiddenError("You can't remove yourself — ask a project admin to do it");
      }
      const target = await prisma.projectMembership.findUnique({
        where: { userId_projectId: { userId, projectId } },
      });
      if (!target || target.role === "ADMIN") {
        throw new ForbiddenError("Only a project admin can remove an admin");
      }
    }
  }

  await assertNotLastProjectAdmin(projectId, userId, "removed");

  await prisma.projectMembership.delete({
    where: { userId_projectId: { userId, projectId } },
  });
  revalidatePath(`/projects/${projectId}`);
}

/** Throws if removing/demoting this member would leave the project with zero admins. */
async function assertNotLastProjectAdmin(
  projectId: string,
  userId: string,
  action: "removed" | "demoted",
) {
  const target = await prisma.projectMembership.findUnique({
    where: { userId_projectId: { userId, projectId } },
  });
  if (target?.role !== "ADMIN") return;

  const adminCount = await prisma.projectMembership.count({
    where: { projectId, role: "ADMIN" },
  });
  if (adminCount <= 1) {
    throw new ForbiddenError(
      `This project needs at least one admin — promote someone else before this person is ${action}`,
    );
  }
}

/** Only a project admin (or Super Admin) may promote/demote anyone — members can't change roles at all. */
export async function updateProjectMemberRole(
  projectId: string,
  userId: string,
  role: MembershipRole,
) {
  await requireProjectMember(projectId, { adminOnly: true });
  if (role !== "ADMIN") {
    await assertNotLastProjectAdmin(projectId, userId, "demoted");
  }
  await prisma.projectMembership.update({
    where: { userId_projectId: { userId, projectId } },
    data: { role },
  });
  revalidatePath(`/projects/${projectId}`);
}

/**
 * Any company member may remove another plain member. Removing an admin, or
 * removing yourself, requires being a company admin (or Super Admin) — a
 * regular member can only ever remove other regular members.
 */
export async function removeCompanyMember(companyId: string, userId: string) {
  const actor = await requireCompanyMember(companyId);

  if (actor.role !== "SUPER_ADMIN") {
    const actorMembership = await prisma.companyMembership.findUnique({
      where: { userId_companyId: { userId: actor.id, companyId } },
    });
    const actorIsAdmin = actorMembership?.role === "ADMIN";

    if (!actorIsAdmin) {
      if (userId === actor.id) {
        throw new ForbiddenError("You can't remove yourself — ask a company admin to do it");
      }
      const target = await prisma.companyMembership.findUnique({
        where: { userId_companyId: { userId, companyId } },
      });
      if (!target || target.role === "ADMIN") {
        throw new ForbiddenError("Only a company admin can remove an admin");
      }
    }
  }

  await assertNotLastCompanyAdmin(companyId, userId, "removed");

  await prisma.companyMembership.delete({
    where: { userId_companyId: { userId, companyId } },
  });
  revalidatePath(`/companies/${companyId}`);
}

/** Throws if removing/demoting this member would leave the company with zero admins. */
async function assertNotLastCompanyAdmin(
  companyId: string,
  userId: string,
  action: "removed" | "demoted",
) {
  const target = await prisma.companyMembership.findUnique({
    where: { userId_companyId: { userId, companyId } },
  });
  if (target?.role !== "ADMIN") return;

  const adminCount = await prisma.companyMembership.count({
    where: { companyId, role: "ADMIN" },
  });
  if (adminCount <= 1) {
    throw new ForbiddenError(
      `This company needs at least one admin — promote someone else before this person is ${action}`,
    );
  }
}

/** Only a company admin (or Super Admin) may promote/demote anyone — members can't change roles at all. */
export async function updateCompanyMemberRole(
  companyId: string,
  userId: string,
  role: MembershipRole,
) {
  await requireCompanyAdmin(companyId);
  if (role !== "ADMIN") {
    await assertNotLastCompanyAdmin(companyId, userId, "demoted");
  }
  await prisma.companyMembership.update({
    where: { userId_companyId: { userId, companyId } },
    data: { role },
  });
  revalidatePath(`/companies/${companyId}`);
}

/**
 * Any project member may rename themselves; renaming someone else requires
 * being a project admin (or Super Admin).
 *
 * The target's membership is checked too, not just the caller's. Without it,
 * being an admin *anywhere* was enough to rename *anyone* on the platform —
 * including a Super Admin, or someone at another company — because the update
 * keyed on a bare `userId` that never had to relate to `projectId` at all.
 */
export async function updateProjectMemberName(
  rawProjectId: string,
  rawUserId: string,
  rawName: string,
) {
  const {
    scopeId: projectId,
    userId,
    name,
  } = parse(memberNameInput, { scopeId: rawProjectId, userId: rawUserId, name: rawName });
  const viewer = await requireProjectMember(projectId);
  if (viewer.id !== userId) {
    await requireProjectMember(projectId, { adminOnly: true });
    const target = await prisma.projectMembership.findUnique({
      where: { userId_projectId: { userId, projectId } },
    });
    if (!target) throw new NotFoundError("That person isn't a member of this project");
  }
  await prisma.user.update({ where: { id: userId }, data: { name } });
  revalidatePath(`/projects/${projectId}`);
}

/** Any company member may rename themselves; renaming someone else requires being a company admin (or Super Admin). */
export async function updateCompanyMemberName(
  rawCompanyId: string,
  rawUserId: string,
  rawName: string,
) {
  const {
    scopeId: companyId,
    userId,
    name,
  } = parse(memberNameInput, { scopeId: rawCompanyId, userId: rawUserId, name: rawName });
  const viewer = await requireCompanyMember(companyId);
  if (viewer.id !== userId) {
    await requireCompanyAdmin(companyId);
    const target = await prisma.companyMembership.findUnique({
      where: { userId_companyId: { userId, companyId } },
    });
    if (!target) throw new NotFoundError("That person isn't a member of this company");
  }
  await prisma.user.update({ where: { id: userId }, data: { name } });
  revalidatePath(`/companies/${companyId}`);
}

