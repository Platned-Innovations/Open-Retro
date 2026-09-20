"use client";

import { useState } from "react";
import {
  Button,
  InlineAlert,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalTitle,
  Select,
  Toggle,
} from "@platned/ui";
import { configureRetroFlow } from "@/server/actions/retros";
import type { RetroBoard } from "@/server/queries/retros";
import { useAction } from "@/lib/useAction";

const VOTE_BUDGETS = [
  { value: "0", label: "Unlimited" },
  { value: "3", label: "3 votes" },
  { value: "5", label: "5 votes" },
  { value: "7", label: "7 votes" },
  { value: "10", label: "10 votes" },
];

const DISCUSS_DURATIONS = [
  { value: "180", label: "3 min per card" },
  { value: "300", label: "5 min per card" },
  { value: "600", label: "10 min per card" },
];

/** How the facilitator shapes this particular session. Moderators only. */
export function PhaseSettingsDialog({
  retro,
  onClose,
}: {
  retro: RetroBoard;
  onClose: () => void;
}) {
  const { run, isPending } = useAction();
  const [isGuided, setIsGuided] = useState(retro.isGuided);
  const [hideOthersCards, setHideOthersCards] = useState(retro.hideOthersCards);
  const [hideVoteCounts, setHideVoteCounts] = useState(retro.hideVoteCounts);
  const [checkInEnabled, setCheckInEnabled] = useState(retro.checkInEnabled);
  const [voteBudget, setVoteBudget] = useState(String(retro.voteBudget));
  const [discussSeconds, setDiscussSeconds] = useState(String(retro.discussSeconds));

  function save() {
    run(
      () =>
        configureRetroFlow({
          retrospectiveId: retro.id,
          isGuided,
          // Only sent when it can still be honoured, so the action's refusal is
          // reserved for a genuine attempt rather than a stale form value.
          ...(retro.canHideCards ? { hideOthersCards } : {}),
          hideVoteCounts,
          checkInEnabled,
          voteBudget: Number(voteBudget),
          discussSeconds: Number(discussSeconds),
        }),
      { onSuccess: onClose },
    );
  }

  return (
    <Modal isOpen onClose={onClose} label="Session settings" size="sm">
      <ModalHeader divider>
        <ModalTitle>Session settings</ModalTitle>
      </ModalHeader>
      <ModalBody className="flex flex-col gap-4">
        <Toggle
          checked={isGuided}
          onChange={setIsGuided}
          label="Guided session"
        />
        <p className="-mt-2 text-body-tiny text-default-secondary">
          Off means every activity stays open at once, the way a board worked before
          phases existed.
        </p>

        <Toggle
          checked={hideOthersCards}
          onChange={setHideOthersCards}
          disabled={!retro.canHideCards}
          label="Hide other people's cards while collecting"
        />
        {!retro.canHideCards && (
          <InlineAlert tone="info">
            Cards on this board have already been revealed. Hiding them again wouldn&apos;t
            un-see them, so this can&apos;t be switched back on.
          </InlineAlert>
        )}

        <Toggle
          checked={hideVoteCounts}
          onChange={setHideVoteCounts}
          label="Hide vote counts until voting ends"
        />

        <Toggle
          checked={checkInEnabled}
          onChange={setCheckInEnabled}
          label="Team health check-in"
        />
        <p className="-mt-2 text-body-tiny text-default-secondary">
          Adds a step before the board: five anonymous questions about the last sprint.
          Answers stay hidden until enough people have replied.
        </p>

        <Select
          label="Votes per person"
          options={VOTE_BUDGETS}
          value={voteBudget}
          onChange={(e) => setVoteBudget(e.target.value)}
        />

        <Select
          label="Discussion time"
          options={DISCUSS_DURATIONS}
          value={discussSeconds}
          onChange={(e) => setDiscussSeconds(e.target.value)}
        />
      </ModalBody>
      <ModalFooter divider align="end">
        <Button variant="neutral" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={save} disabled={isPending}>
          Save
        </Button>
      </ModalFooter>
    </Modal>
  );
}
