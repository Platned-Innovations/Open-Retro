"use server";

/** Server Action boundary for the admin console. See src/server/actions/result.ts. */

import * as org from "@/server/org/users";
import { run } from "@/server/actions/result";

type Args<T extends (...args: never[]) => unknown> = Parameters<T>;

export async function updateUserName(...args: Args<typeof org.updateUserName>) {
  return run(() => org.updateUserName(...args));
}

export async function updateUserGlobalRole(...args: Args<typeof org.updateUserGlobalRole>) {
  return run(() => org.updateUserGlobalRole(...args));
}

export async function assignUserToProject(...args: Args<typeof org.assignUserToProject>) {
  return run(() => org.assignUserToProject(...args));
}
