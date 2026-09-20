"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Settings2 } from "lucide-react";
import { Button, IconButton, InlineAlert, ProgressBar, Stepper } from "@platned/ui";
import { PhaseSettingsDialog } from "@/components/retro/phase-settings-dialog";
import { stepRetroPhase } from "@/server/actions/retros";
import type { RetroBoard } from "@/server/queries/retros";
import { PHASE_HINTS, PHASE_LABELS, nextPhase, previousPhase, toStepperSteps } from "@/lib/retroPhases";
import { useAction } from "@/lib/useAction";

/**
 * The session's control surface: where everyone is, what this step is for, and
 * (for a moderator) how to move on.
 *
 * `Stepper` from @platned/ui is display-only — it has no click handler — which
 * suits this: jumping the group to an arbitrary step by clicking a label is
 * rarely what anyone means, so navigation is the explicit Back/Next pair.
 */
export function PhaseBar({ retro }: { retro: RetroBoard }) {
  const { run, isPending } = useAction();
  const [settingsOpen, setSettingsOpen] = useState(false);

  const { canModerate } = retro.viewer;
  const flow = { checkInEnabled: retro.checkInEnabled };
  const steps = toStepperSteps(retro.phase, flow);
  const next = nextPhase(retro.phase, flow);
  const previous = previousPhase(retro.phase, flow);

  const spent = retro.voteBudget - (retro.votesRemaining ?? 0);
  const showVoteBudget = retro.phase === "VOTE" && retro.votesRemaining !== null;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-default bg-default-secondary p-4">
      <Stepper steps={steps} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-body-sm text-default-secondary">{PHASE_HINTS[retro.phase]}</p>

        {canModerate && (
          <div className="flex shrink-0 items-center gap-2">
            <IconButton
              variant="subtle"
              size="sm"
              aria-label="Session settings"
              onClick={() => setSettingsOpen(true)}
            >
              <Settings2 className="h-4 w-4" />
            </IconButton>
            <IconButton
              variant="neutral"
              size="sm"
              aria-label={previous ? `Back to ${PHASE_LABELS[previous]}` : "Already at the first step"}
              disabled={!previous || isPending}
              onClick={() => run(() => stepRetroPhase({ retrospectiveId: retro.id, direction: "previous" }))}
            >
              <ChevronLeft className="h-4 w-4" />
            </IconButton>
            <Button
              size="sm"
              disabled={!next || isPending}
              onClick={() => run(() => stepRetroPhase({ retrospectiveId: retro.id, direction: "next" }))}
              trailingIcon={<ChevronRight className="h-3.5 w-3.5" />}
            >
              {next ? `Next: ${PHASE_LABELS[next]}` : "Finished"}
            </Button>
          </div>
        )}
      </div>

      {showVoteBudget && (
        <div className="flex items-center gap-3">
          <ProgressBar
            value={retro.voteBudget === 0 ? 0 : (spent / retro.voteBudget) * 100}
            tone={retro.votesRemaining === 0 ? "warning" : "brand"}
            size="sm"
            className="max-w-48"
            aria-label={`${retro.votesRemaining} of ${retro.voteBudget} votes remaining`}
          />
          <span className="text-body-sm text-default-secondary">
            {retro.votesRemaining} of {retro.voteBudget} votes left
          </span>
        </div>
      )}

      {/* Non-moderators get told what is happening rather than left to guess
          why the board stopped accepting what they were doing a moment ago. */}
      {!canModerate && retro.phase !== "CLOSED" && (
        <InlineAlert tone="info">
          The facilitator moves everyone on together.
        </InlineAlert>
      )}

      {settingsOpen && (
        <PhaseSettingsDialog retro={retro} onClose={() => setSettingsOpen(false)} />
      )}
    </div>
  );
}
