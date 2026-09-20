"use server";

/** Server Action boundary for companies. See src/server/actions/result.ts. */

import * as org from "@/server/org/companies";
import { run } from "@/server/actions/result";

type Args<T extends (...args: never[]) => unknown> = Parameters<T>;

export async function createCompany(...args: Args<typeof org.createCompany>) {
  return run(() => org.createCompany(...args));
}

export async function deleteCompany(...args: Args<typeof org.deleteCompany>) {
  return run(() => org.deleteCompany(...args));
}

export async function setCompanyAiFeatures(...args: Args<typeof org.setCompanyAiFeatures>) {
  return run(() => org.setCompanyAiFeatures(...args));
}
