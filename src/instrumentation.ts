/**
 * Runs once when the Next.js server starts, before it serves a request.
 *
 * Two things live here, and the reason they live *here* rather than in
 * server.ts is the same for both: this file is bundled by Next, so it can
 * import the app's own modules — the ones marked `server-only`, which throw
 * on import under plain `tsx` and therefore cannot appear in the custom
 * server's graph at all. (That constraint is why src/lib/socket/roomAccess.ts
 * is deliberately standalone; see the note there.)
 */
import type { Instrumentation } from "next";

export async function register() {
  // `register` is called in the Edge runtime too, and Turbopack traces the
  // dynamic import below into that bundle whether or not it ever runs —
  // dragging Prisma, which cannot work there, in with it. The runtime check is
  // what the Next docs prescribe for exactly this.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // Opt-in, so scaling out later means "set it on one instance" rather than
  // every instance mailing the same people the same reminders.
  if (process.env.RUN_SCHEDULER !== "true") {
    if (process.env.NODE_ENV === "production") {
      console.warn(
        "[scheduler] not running — due-date reminders and cleanup are off. " +
          "Set RUN_SCHEDULER=true on exactly one instance to enable them.",
      );
    }
    return;
  }

  // Dynamic, so nothing in the scheduler's graph is even resolved on an
  // instance that isn't running it.
  const { startScheduler } = await import("@/server/scheduler");
  startScheduler();
}

/**
 * Every server-side error, in one place.
 *
 * `console.error` was the entire observability story, which on App Service
 * means the errors exist but nobody is looking. This does not fix that on its
 * own — it is the single seam an APM agent gets wired into, so that when one
 * is added it is one change here rather than a hunt through every catch block.
 *
 * Deliberately not swallowing: it logs with the route context Next hands us,
 * which is the part a bare console.error in a server action could never know.
 */
export const onRequestError: Instrumentation.onRequestError = (error, request, context) => {
  const message = error instanceof Error ? error.message : String(error);
  const digest =
    typeof error === "object" && error !== null && "digest" in error
      ? String(error.digest)
      : undefined;

  console.error(
    `[error] ${context.routeType} ${request.method} ${request.path}` +
      (digest ? ` (digest ${digest})` : ""),
    message,
    error instanceof Error ? error.stack : undefined,
  );
};
