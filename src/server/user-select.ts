import "server-only";

/**
 * The only sanctioned ways to pull a User into a query result.
 *
 * Prisma's `include: { user: true }` selects *every* scalar on the model —
 * which, for User, means `passwordHash` and `email`. Those results are handed
 * to `"use client"` components, so they land in the RSC Flight payload the
 * browser receives: every project member could read the Super Admin's bcrypt
 * hash from the page source of any board they shared.
 *
 * Pick the narrowest constant the UI actually needs. If none of them fit, that
 * is a prompt to think about what is really being rendered — not to reach for
 * `include: { user: true }`.
 */

/** Anything rendered next to content: card authors, comments, assignee chips, facilitator bylines. */
export const USER_PUBLIC_SELECT = { select: { id: true, name: true } } as const;

/**
 * Member-management surfaces only. The email is the disambiguator a human
 * needs to tell two people with the same name apart, and both the member list
 * and the invite dialog search on it.
 */
export const USER_DIRECTORY_SELECT = { select: { id: true, name: true, email: true } } as const;

/** The Super Admin console, which additionally shows platform role and join date. */
export const USER_ADMIN_SELECT = {
  select: { id: true, name: true, email: true, role: true, createdAt: true },
} as const;

/**
 * Server-side email fan-out only. A result selected with this must never be
 * returned from a query or a Server Action — load it in the notify helper and
 * let it die there.
 */
export const USER_MAILABLE_SELECT = { select: { id: true, name: true, email: true } } as const;
