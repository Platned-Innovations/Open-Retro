import "server-only";
import type { z } from "zod";
import { BadRequestError } from "@/lib/authz";

/**
 * Validates a Server Action's input at the boundary.
 *
 * Throws `BadRequestError` rather than returning a result, so that every
 * refusal in the codebase — unauthorized, forbidden, not found, malformed —
 * travels the same way and is mapped to a user-facing message in exactly one
 * place.
 *
 * Only the first issue's message is surfaced. The full Zod issue list names
 * field paths and received values, which is more than a toast should say and
 * more than a caller needs to be told.
 */
export function parse<T extends z.ZodType>(schema: T, input: unknown): z.infer<T> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new BadRequestError(result.error.issues[0]?.message ?? "Invalid input");
  }
  return result.data;
}
