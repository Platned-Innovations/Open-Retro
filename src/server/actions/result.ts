import "server-only";
import { Prisma } from "@/generated/prisma/client";
import type { ActionResult } from "@/types/action-result";
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} from "@/lib/authz";

/**
 * Turns the refusals we author into something a browser can actually read.
 *
 * All the carefully worded messages in authz.ts — "This project needs at least
 * one admin", "Only a project admin can invite someone as an admin" — reached
 * users as an opaque digest in production, because Next.js masks uncaught
 * Server Action errors. The entire authorization-feedback UX only worked in
 * `npm run dev`, and the validation messages would have shared that fate.
 *
 * `{ ok: true }` was already the convention in a few places
 * (inviteUserToProject and friends), so this regularises what was there rather
 * than importing a new idea.
 *
 * Reads are deliberately NOT migrated: they live in src/server/queries/ and are
 * called from Server Components that catch NotFoundError to call notFound() and
 * let ForbiddenError reach the error boundary. Throwing is the right convention
 * there; results are the right convention for actions.
 */
export type { ActionResult };

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function fail(error: string): ActionResult<never> {
  return { ok: false, error };
}

const GENERIC_MESSAGE = "Something went wrong. Please try again.";

/**
 * Runs an action body and turns the refusals we author into messages a user can
 * act on. Anything unexpected is logged and replaced with a generic line —
 * relaying a raw error would eventually relay a connection string.
 */
export async function run<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return ok(await fn());
  } catch (error) {
    if (
      error instanceof UnauthorizedError ||
      error instanceof ForbiddenError ||
      error instanceof NotFoundError ||
      error instanceof BadRequestError
    ) {
      return fail(error.message);
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") return fail("That already exists.");
      if (error.code === "P2025") return fail("That no longer exists — try refreshing.");
    }

    console.error("Unhandled server action error:", error);
    return fail(GENERIC_MESSAGE);
  }
}
