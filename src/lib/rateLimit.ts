import "server-only";

/**
 * A fixed-window rate limiter held in this process's memory.
 *
 * In-memory is the honest fit for how this app is deployed: one Azure Web App
 * instance with Always On, and the Socket.IO presence map in server.ts is
 * already process-local for the same reason. The trade-off is explicit — counts
 * reset when the process restarts, and would not be shared if the plan ever
 * scales out. If that day comes this is the piece to move to Redis, alongside
 * the Socket.IO adapter.
 */

type Window = { count: number; resetAt: number };

const windows = new Map<string, Window>();

/**
 * Evicting expired keys matters: `requestLoginLink` is reachable
 * unauthenticated with an attacker-chosen key, so a map that only ever grew
 * would itself be the denial of service.
 */
const SWEEP_INTERVAL_MS = 60_000;

let sweepTimer: ReturnType<typeof setInterval> | undefined;

function ensureSweeping() {
  if (sweepTimer) return;
  sweepTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, window] of windows) {
      if (window.resetAt <= now) windows.delete(key);
    }
  }, SWEEP_INTERVAL_MS);
  // Never hold the process open just to run the sweep.
  sweepTimer.unref?.();
}

export type RateLimitResult = { ok: true } | { ok: false; retryAfterMs: number };

export function rateLimit(
  key: string,
  opts: { limit: number; windowMs: number },
): RateLimitResult {
  ensureSweeping();

  const now = Date.now();
  const existing = windows.get(key);

  if (!existing || existing.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + opts.windowMs });
    return { ok: true };
  }

  if (existing.count >= opts.limit) {
    return { ok: false, retryAfterMs: existing.resetAt - now };
  }

  existing.count += 1;
  return { ok: true };
}

/** Test seam. Not used by application code. */
export function resetRateLimits() {
  windows.clear();
}
