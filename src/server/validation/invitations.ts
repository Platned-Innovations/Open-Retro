import "server-only";
import { z } from "zod";
import { MembershipRole } from "@/generated/prisma/enums";
import { email, id, name } from "@/server/validation/common";

/**
 * Invites auto-create a User row for whatever address they are handed, so
 * without a format check any string at all became a permanent account. Combined
 * with a paste-many-addresses UI and no rate limit, that was unbounded
 * user-table growth from typos and junk.
 */
export const inviteToProjectInput = z.object({
  projectId: id,
  email,
  role: z.enum(MembershipRole).optional(),
});

export const inviteToCompanyInput = z.object({
  companyId: id,
  email,
  role: z.enum(MembershipRole).optional(),
});

export const addExistingMemberInput = z.object({
  projectId: id,
  userId: id,
  role: z.enum(MembershipRole).optional(),
});

export const memberNameInput = z.object({
  scopeId: id,
  userId: id,
  name,
});

export const memberRoleInput = z.object({
  scopeId: id,
  userId: id,
  role: z.enum(MembershipRole),
});

export const removeMemberInput = z.object({
  scopeId: id,
  userId: id,
});
