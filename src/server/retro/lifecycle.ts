import "server-only";

/**
 * The retrospective itself: creating one, moving it through its statuses,
 * deleting it, and the shared countdown timer.
 *
 * Not a `"use server"` module: these throw ForbiddenError/NotFoundError/
 * BadRequestError, and src/server/actions/retros.ts is the boundary that turns
 * those into an ActionResult the browser can actually read. Keeping the two
 * apart means the rules stay directly testable — a test can assert that
 * updateCard *refuses*, rather than inspecting a mapped payload — and the
 * boundary stays a uniform one-liner per action that nobody has to reason about.
 */

import { prisma } from "@/lib/prisma";
import { requireProjectMember, requireRetroModerator } from "@/lib/authz";
import { COLUMN_TEMPLATES } from "@/lib/retroTemplates";
import { revalidatePath } from "next/cache";
import type { RetroTemplate } from "@/generated/prisma/client";
import { broadcastToRetro } from "@/lib/socket/emit";
import { parse } from "@/server/validation/parse";
import {
  createRetrospectiveInput,
  retroOnlyInput,
  setRetroStatusInput,
  startTimerInput,
} from "@/server/validation/retros";

export async function createRetrospective(rawInput: {
  projectId: string;
  title: string;
  template: RetroTemplate;
  customColumns?: string[];
  isAnonymous?: boolean;
  isGuided?: boolean;
  voteBudget?: number;
  hideOthersCards?: boolean;
}) {
  const input = parse(createRetrospectiveInput, rawInput);
  const user = await requireProjectMember(input.projectId);

  const columns =
    input.template === "CUSTOM"
      ? (input.customColumns ?? []).map((title, i) => ({ title, color: DEFAULT_COLORS[i % DEFAULT_COLORS.length], order: i }))
      : COLUMN_TEMPLATES[input.template].map((c, i) => ({ ...c, order: i }));

  const retro = await prisma.retrospective.create({
    data: {
      projectId: input.projectId,
      title: input.title,
      template: input.template,
      status: "ACTIVE",
      isAnonymous: input.isAnonymous ?? false,
      facilitatorId: user.id,
      createdById: user.id,
      startedAt: new Date(),
      // A guided retro opens in LOBBY, so the facilitator can let people arrive
      // before anyone starts writing. An unguided one goes straight to COLLECT,
      // since it has no steps to wait for.
      isGuided: input.isGuided ?? true,
      phase: (input.isGuided ?? true) ? "LOBBY" : "COLLECT",
      phaseStartedAt: new Date(),
      voteBudget: input.voteBudget ?? 5,
      hideOthersCards: input.hideOthersCards ?? true,
      columns: { create: columns },
    },
    include: { columns: true },
  });

  revalidatePath(`/projects/${input.projectId}`);
  return retro;
}

const DEFAULT_COLORS = ["#6366f1", "#22c55e", "#f97316", "#ef4444", "#3b82f6", "#a855f7"];

export async function setRetroStatus(
  rawRetrospectiveId: string,
  rawStatus: "ACTIVE" | "COMPLETED" | "ARCHIVED",
) {
  const { retrospectiveId, status } = parse(setRetroStatusInput, {
    retrospectiveId: rawRetrospectiveId,
    status: rawStatus,
  });
  await requireRetroModerator(retrospectiveId);
  const retro = await prisma.retrospective.update({
    where: { id: retrospectiveId },
    data: { status, endedAt: status === "COMPLETED" ? new Date() : undefined },
  });
  broadcastToRetro(retrospectiveId, "retro:statusChange", {});
  revalidatePath(`/retros/${retrospectiveId}`);
  return retro;
}

/** Project admins (or Super Admin) may permanently delete a retrospective and everything on its board. */
export async function deleteRetrospective(retrospectiveId: string) {
  const retro = await prisma.retrospective.findUniqueOrThrow({
    where: { id: retrospectiveId },
    select: { projectId: true },
  });
  await requireProjectMember(retro.projectId, { adminOnly: true });

  await prisma.retrospective.delete({ where: { id: retrospectiveId } });
  broadcastToRetro(retrospectiveId, "retro:deleted", {});
  revalidatePath(`/projects/${retro.projectId}`);
}

// --- Timer -------------------------------------------------------------

export async function startTimer(rawRetrospectiveId: string, rawSeconds: number) {
  const { retrospectiveId, seconds } = parse(startTimerInput, {
    retrospectiveId: rawRetrospectiveId,
    seconds: rawSeconds,
  });
  await requireRetroModerator(retrospectiveId);
  const timerEndsAt = new Date(Date.now() + seconds * 1000);
  await prisma.retrospective.update({
    where: { id: retrospectiveId },
    data: { timerSeconds: seconds, timerEndsAt },
  });
  broadcastToRetro(retrospectiveId, "timer:start", { timerEndsAt: timerEndsAt.toISOString() });
  revalidatePath(`/retros/${retrospectiveId}`);
  return { timerEndsAt };
}

export async function stopTimer(rawRetrospectiveId: string) {
  const { retrospectiveId } = parse(retroOnlyInput, { retrospectiveId: rawRetrospectiveId });
  await requireRetroModerator(retrospectiveId);
  await prisma.retrospective.update({
    where: { id: retrospectiveId },
    data: { timerSeconds: null, timerEndsAt: null },
  });
  broadcastToRetro(retrospectiveId, "timer:stop", {});
  revalidatePath(`/retros/${retrospectiveId}`);
}

