"use server";

/**
 * The Server Action boundary for membership and invitations.
 *
 * One uniform wrapper per mutation; the rules live in src/server/org/
 * invitations.ts. See src/server/actions/result.ts for why the mapping has to
 * happen on this side.
 *
 * This module's messages are the ones that motivated the change: "This project
 * needs at least one admin — promote someone else before this person is
 * removed" is only useful if it reaches the person who tried.
 */

import * as org from "@/server/org/invitations";
import { run } from "@/server/actions/result";

type Args<T extends (...args: never[]) => unknown> = Parameters<T>;

export async function inviteUserToProject(...args: Args<typeof org.inviteUserToProject>) {
  return run(() => org.inviteUserToProject(...args));
}

export async function addExistingMemberToProject(
  ...args: Args<typeof org.addExistingMemberToProject>
) {
  return run(() => org.addExistingMemberToProject(...args));
}

export async function inviteUserToCompany(...args: Args<typeof org.inviteUserToCompany>) {
  return run(() => org.inviteUserToCompany(...args));
}

export async function removeProjectMember(...args: Args<typeof org.removeProjectMember>) {
  return run(() => org.removeProjectMember(...args));
}

export async function updateProjectMemberRole(...args: Args<typeof org.updateProjectMemberRole>) {
  return run(() => org.updateProjectMemberRole(...args));
}

export async function removeCompanyMember(...args: Args<typeof org.removeCompanyMember>) {
  return run(() => org.removeCompanyMember(...args));
}

export async function updateCompanyMemberRole(...args: Args<typeof org.updateCompanyMemberRole>) {
  return run(() => org.updateCompanyMemberRole(...args));
}

export async function updateProjectMemberName(...args: Args<typeof org.updateProjectMemberName>) {
  return run(() => org.updateProjectMemberName(...args));
}

export async function updateCompanyMemberName(...args: Args<typeof org.updateCompanyMemberName>) {
  return run(() => org.updateCompanyMemberName(...args));
}
