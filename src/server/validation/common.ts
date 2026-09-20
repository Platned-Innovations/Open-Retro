import "server-only";
import { z } from "zod";
import { REACTIONS } from "@/lib/retroReactions";

/**
 * Shared primitives for Server Action input schemas.
 *
 * The job here is bounding, not authorization: the `require*` guards and the
 * retro-scope helpers are what stop a caller reaching someone else's data.
 * These stop a caller reaching the *database* with a 10 MB card body, a
 * 10,000-column retro, or a negative array index.
 */

/**
 * Deliberately not `z.cuid()`. Tightening this to the current id format would
 * couple every action to `@default(cuid())` in schema.prisma, so a later move
 * to cuid2 or uuid would reject every request in production. Ids are checked
 * for real by the scope guards; here they only need a sane length.
 */
export const id = z.string().min(1).max(64);

export const idList = (max: number) => z.array(id).max(max);

export const title = z.string().trim().min(1, "A title is required").max(120);
export const name = z.string().trim().min(1, "A name is required").max(120);
export const cardContent = z.string().trim().min(1, "A card can't be empty").max(2000);
export const description = z.string().trim().min(1, "A description is required").max(1000);
export const optionalLongText = z.string().trim().max(2000).optional();

/** Array#splice reads a negative index as an offset from the end. */
export const orderIndex = z.number().int().min(0).max(5000);

export const email = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .refine((value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), "That doesn't look like an email address");

/** Closed set, so `Reaction.emoji` stops being an arbitrary string column. */
export const reactionEmoji = z.enum(REACTIONS);

/**
 * Ten seconds to two hours. `startTimer` previously took any number, so
 * `seconds: 1e15` produced an Invalid Date that the countdown then rendered
 * forever.
 */
export const timerSeconds = z.number().int().min(10).max(7200);
