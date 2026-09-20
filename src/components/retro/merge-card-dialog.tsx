"use client";

import { useMemo, useState } from "react";
import {
  Button,
  EmptyState,
  Input,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "@platned/ui";
import { groupCards } from "@/server/actions/retros";
import type { RetroCardWithRelations } from "@/server/queries/retros";
import { useAction } from "@/lib/useAction";
import { cn } from "@/lib/utils";

/** Enough to scan; beyond this, typing is faster than scrolling anyway. */
const MAX_SHOWN = 20;

/**
 * Picking the card to merge into.
 *
 * Replaces one dropdown item per other card in the column. That menu was
 * O(n²) — a 40-card column built 40 menus of 39 items, 1,560 array entries on
 * every render — and unusable long before it was slow: a 39-item menu is not
 * something anyone reads.
 *
 * The sibling list arrives as one shared array and is filtered here, only
 * while the dialog is open, so the cost is paid by the person who asked for
 * it rather than by every card on every render.
 */
export function MergeCardDialog({
  retrospectiveId,
  card,
  siblingCards,
  onClose,
}: {
  retrospectiveId: string;
  card: RetroCardWithRelations;
  siblingCards: RetroCardWithRelations[];
  onClose: () => void;
}) {
  const { run, isPending } = useAction();
  const [query, setQuery] = useState("");

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return siblingCards
      .filter((c) => c.id !== card.id && (!q || c.content.toLowerCase().includes(q)))
      .slice(0, MAX_SHOWN);
  }, [siblingCards, card.id, query]);

  const total = siblingCards.length - 1;

  return (
    <Modal isOpen onClose={onClose} label="Merge this card into another" size="sm">
      <ModalHeader divider>
        <ModalTitle>Merge into…</ModalTitle>
      </ModalHeader>
      <ModalBody className="flex flex-col gap-3">
        <p className="text-body-sm text-default-secondary">
          &ldquo;{card.content.slice(0, 80)}
          {card.content.length > 80 ? "…" : ""}&rdquo; will be stacked under the card you pick.
        </p>

        {total > MAX_SHOWN && (
          <Input
            size="sm"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search this column…"
            autoFocus
          />
        )}

        {matches.length === 0 ? (
          <EmptyState
            message={total === 0 ? "There is nothing else in this column yet." : "No card matches that."}
          />
        ) : (
          <div className="flex max-h-72 flex-col gap-1 overflow-y-auto">
            {matches.map((target) => (
              <button
                key={target.id}
                type="button"
                disabled={isPending}
                onClick={() =>
                  run(() => groupCards(retrospectiveId, card.id, target.id), { onSuccess: onClose })
                }
                className={cn(
                  "rounded-md border border-default px-3 py-2 text-left text-body-sm text-default",
                  "hover:border-brand hover:bg-brand-tertiary",
                )}
              >
                {target.content}
              </button>
            ))}
          </div>
        )}

        {total > matches.length && (
          <p className="text-body-tiny text-default-secondary">
            Showing {matches.length} of {total}. Type to narrow it down.
          </p>
        )}
      </ModalBody>
      <ModalFooter divider align="end">
        <Button variant="neutral" onClick={onClose}>
          Cancel
        </Button>
      </ModalFooter>
    </Modal>
  );
}
