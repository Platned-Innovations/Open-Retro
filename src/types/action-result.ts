/**
 * What every Server Action returns.
 *
 * Lives here rather than beside `run()` because client components need the
 * type, and the module that implements the mapping is server-only.
 *
 * Next.js replaces the message of an *uncaught* Server Action error with an
 * opaque digest in production builds, so a thrown refusal reaches the user as
 * "An error occurred in the Server Components render" no matter how carefully
 * it was worded. Returning the message is what makes it survive.
 */
export type ActionResult<T = void> = { ok: true; data: T } | { ok: false; error: string };
