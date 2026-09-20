"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { ActionResult } from "@/types/action-result";

/**
 * Calls a Server Action, surfaces its refusal, and refreshes on success.
 *
 * Replaces three byte-identical local `run(action)` helpers (retro-card-item,
 * action-items-panel, retro-timer) and the same try/catch-and-toast shape
 * copied across roughly a dozen more components.
 *
 * The catch is for the call failing outright — offline, a dropped connection.
 * A refusal no longer arrives as an exception: it comes back as
 * `{ ok: false, error }`, which is the whole point of the result shape.
 */
export function useAction() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function run<T>(
    action: () => Promise<ActionResult<T>>,
    options: {
      onSuccess?: (data: T) => void;
      /**
       * Fires on a refusal *and* on the call failing outright.
       *
       * For local state that mirrors a server value — a toggle someone has
       * just flipped — so it can go back to what the server still holds
       * instead of sitting there showing a setting that isn't in effect. The
       * toast is still shown either way.
       */
      onError?: () => void;
      refresh?: boolean;
      /**
       * Applied immediately, inside the transition, before the round trip.
       * `useOptimistic` updates are only allowed there — and React discards
       * them automatically once the refreshed server data arrives, which is
       * also what makes a failed action snap back on its own.
       */
      optimistic?: () => void;
    } = {},
  ) {
    const { onSuccess, onError, refresh = true, optimistic } = options;

    startTransition(async () => {
      optimistic?.();
      try {
        const result = await action();
        if (!result.ok) {
          toast.error(result.error);
          onError?.();
          return;
        }
        onSuccess?.(result.data);
        if (refresh) router.refresh();
      } catch {
        toast.error("Couldn't reach the server. Check your connection and try again.");
        onError?.();
      }
    });
  }

  return { run, isPending };
}
