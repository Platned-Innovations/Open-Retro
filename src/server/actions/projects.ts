"use server";

/** Server Action boundary for projects. See src/server/actions/result.ts. */

import * as org from "@/server/org/projects";
import { run } from "@/server/actions/result";

type Args<T extends (...args: never[]) => unknown> = Parameters<T>;

export async function createProject(...args: Args<typeof org.createProject>) {
  return run(() => org.createProject(...args));
}

export async function deleteProject(...args: Args<typeof org.deleteProject>) {
  return run(() => org.deleteProject(...args));
}
