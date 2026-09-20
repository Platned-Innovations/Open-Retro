"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button, ConfirmDialog } from "@platned/ui";
import type { ActionResult } from "@/types/action-result";

/**
 * Confirm-then-delete for anything destructive and cascading (retro,
 * project, company). Always navigates away on success, since the current
 * page no longer exists once the thing it shows is gone.
 *
 * `action` must be a direct reference to a "use server" function (not a
 * closure wrapping one) — this component is sometimes rendered from a
 * Server Component page, and only a real Server Action reference is
 * allowed to cross that boundary as a prop.
 */
export function DeleteConfirmButton({
  label,
  title,
  description,
  action,
  id,
  redirectTo,
  size = "sm",
}: {
  label: string;
  title: string;
  description: string;
  action: (id: string) => Promise<ActionResult<unknown>>;
  id: string;
  redirectTo: string;
  size?: "sm" | "md";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    startTransition(async () => {
      try {
        const result = await action(id);
        // Checking `ok` before navigating matters: a refused delete used to
        // take the user to the parent page and look like it had worked.
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        toast.success(`${title.replace(/\?$/, "")} deleted`);
        setOpen(false);
        router.push(redirectTo);
      } catch {
        toast.error("Couldn't reach the server. Check your connection and try again.");
      }
    });
  }

  return (
    <>
      <Button variant="danger" size={size} onClick={() => setOpen(true)} leadingIcon={<Trash2 className="h-3.5 w-3.5" />}>
        {label}
      </Button>
      <ConfirmDialog
        isOpen={open}
        onClose={() => setOpen(false)}
        onConfirm={handleConfirm}
        title={title}
        subtitle={description}
        tone="danger"
        confirmLabel="Delete"
        confirmVariant="danger"
        isConfirming={isPending}
        confirmingLabel="Deleting…"
      />
    </>
  );
}
