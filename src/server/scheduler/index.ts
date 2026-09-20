import "server-only";

/**
 * The scheduler loop.
 *
 * There was none at all, which is why `dueDate` existed with nothing acting on
 * it: the tool would let a team agree a deadline and then never mention it
 * again.
 *
 * An interval in the web process rather than a queue, deliberately. This
 * deploys as a single Azure Web App with Always On, the presence map is
 * already process-local, and a queue would be a second piece of infrastructure
 * to run, monitor and pay for in order to send a handful of emails a day. The
 * `RUN_SCHEDULER` flag is what makes that reversible: when this does scale
 * out, it means "set it on one instance", and the day it needs to be a real
 * worker, jobs.ts moves across unchanged because it holds no timing logic.
 *
 * What this is not: durable. A job that fails is logged and retried on the
 * next tick, and work scheduled while the process is down simply happens late.
 * For "remind people about a deadline" that is the right trade. It would not
 * be for anything transactional, and nothing transactional should move here.
 */

import {
  purgeDeadLoginTokens,
  purgeExpiredInvitations,
  sendDueDateReminders,
} from "@/server/scheduler/jobs";

const TICK_MS = 15 * 60 * 1000;

/** A tick starting while the previous one is still running would double-send. */
let running = false;

type Job = { name: string; run: (now: Date) => Promise<unknown> };

const JOBS: Job[] = [
  { name: "due-date-reminders", run: sendDueDateReminders },
  { name: "purge-login-tokens", run: purgeDeadLoginTokens },
  { name: "purge-expired-invitations", run: purgeExpiredInvitations },
];

export async function runScheduledJobs(now: Date = new Date()): Promise<void> {
  if (running) {
    console.warn("Scheduler tick skipped — the previous one is still running");
    return;
  }
  running = true;

  try {
    for (const job of JOBS) {
      try {
        const result = await job.run(now);
        console.log(`[scheduler] ${job.name}`, result);
      } catch (error) {
        // Isolated per job: one failure must not stop the others, and must
        // certainly not take down the web server sharing this process.
        console.error(`[scheduler] ${job.name} failed:`, error);
      }
    }
  } finally {
    running = false;
  }
}

/**
 * Whether this process is configured well enough to be allowed to email people.
 *
 * Every reminder embeds APP_URL. A process with a placeholder or localhost
 * APP_URL will still find real assignees in whatever database it is pointed
 * at and send them real mail through real Graph credentials, carrying a link
 * that goes nowhere — and the marker means they never get a correct one.
 *
 * This is not hypothetical. It happened during development: a throwaway boot
 * check, started with RUN_SCHEDULER=true and APP_URL=https://example.invalid
 * to prove the server came up, was left running against the live database and
 * fifteen minutes later mailed a real person a dead link. server.ts already
 * refuses to start in production with a localhost APP_URL for exactly this
 * family of reason; the scheduler needs its own check because it is the part
 * that sends without anyone asking it to.
 */
function appUrlIsMailable(): string | null {
  const appUrl = process.env.APP_URL;
  if (!appUrl) return "APP_URL is not set";
  if (appUrl.includes("localhost") || appUrl.includes("127.0.0.1")) {
    return `APP_URL is "${appUrl}"`;
  }
  // Reserved by RFC 2606/6761 precisely so they can never resolve.
  if (/\.(invalid|test|example|localhost)(:|\/|$)/.test(appUrl)) {
    return `APP_URL is "${appUrl}", which can never resolve`;
  }
  return null;
}

/**
 * Starts the loop. Called from instrumentation.ts, behind RUN_SCHEDULER.
 *
 * `unref()` keeps the timer from holding the process open on its own, so a
 * shutdown isn't delayed by up to fifteen minutes waiting for a tick that has
 * nothing to do.
 */
export function startScheduler(): boolean {
  const problem = appUrlIsMailable();
  if (problem) {
    console.error(
      `[scheduler] refusing to start — ${problem}. Every reminder links to APP_URL, ` +
        "and this process would mail real people a link that goes nowhere.",
    );
    return false;
  }

  console.log(`[scheduler] started — every ${TICK_MS / 60000} minutes`);
  // Not on the first tick: a deploy should serve requests before it starts
  // mailing people, and a crash loop would otherwise send on every restart.
  const timer = setInterval(() => void runScheduledJobs(), TICK_MS);
  timer.unref();
  return true;
}
