import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { getRetroBoard } from "@/server/queries/retros";
import { listCarryOverCandidates } from "@/server/retro/carryOver";
import { getHealthSummary } from "@/server/retro/health";
import { NotFoundError } from "@/lib/authz";
import { RetroBoardView } from "@/components/retro/retro-board";

export default async function RetroPage({
  params,
}: {
  params: Promise<{ retroId: string }>;
}) {
  const { retroId } = await params;
  const session = await auth();
  const userId = session!.user.id;

  let retro;
  try {
    retro = await getRetroBoard(retroId);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }

  // Only fetched where it is actionable: setting the session up, or deciding
  // what happens next. Loading it on every board would be a query per view for
  // a panel nobody is looking at.
  const wantsCarryOver =
    retro.viewer.canModerate && (!retro.isGuided || retro.phase === "LOBBY" || retro.phase === "ACTIONS");
  const carryOverCandidates = wantsCarryOver ? await listCarryOverCandidates(retroId) : undefined;

  // Same rule: loaded for the one step where it is the task, not on every view.
  const healthSummary =
    retro.isGuided && retro.checkInEnabled && retro.phase === "CHECK_IN"
      ? await getHealthSummary(retroId)
      : undefined;

  // `retro.viewer` is decided in getRetroBoard. Re-deriving permissions here
  // used to require the raw membership list in the payload, which is precisely
  // what made anonymous boards decodable in the browser.
  return (
    <RetroBoardView
      retro={retro}
      currentUserId={userId}
      carryOverCandidates={carryOverCandidates}
      healthSummary={healthSummary}
    />
  );
}
