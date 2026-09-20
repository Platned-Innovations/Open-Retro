"use client";

import { useState, useTransition } from "react";
import { Button, Input, Modal, ModalHeader, ModalTitle, ModalBody, ModalFooter } from "@platned/ui";

type Props = {
  onClose: () => void;
  currentName: string;
  label: string;
  /**
   * Resolves true when the rename went through. The dialog used to rely on
   * `onSave` throwing to know it had failed; actions return a result now, so
   * the outcome has to be handed back explicitly or a refused rename would
   * close the dialog as though it had worked.
   */
  onSave: (name: string) => Promise<boolean>;
};

/**
 * Controlled name-edit dialog shared by the member list and the admin console.
 * Mount it only while open (e.g. `{open && <RenameDialog ... />}`) — that's
 * what gives `name` a fresh starting value from `currentName` each time.
 */
export function RenameDialog({ onClose, currentName, label, onSave }: Props) {
  const [name, setName] = useState(currentName);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    startTransition(async () => {
      // `onSave` surfaces its own message; this only decides whether to close.
      if (await onSave(trimmed)) onClose();
    });
  }

  return (
    <Modal isOpen onClose={onClose} label={label} size="sm">
      <form onSubmit={handleSubmit}>
        <ModalHeader divider>
          <ModalTitle>{label}</ModalTitle>
        </ModalHeader>
        <ModalBody>
          <Input label="Name" required autoFocus value={name} onChange={(e) => setName(e.target.value)} />
        </ModalBody>
        <ModalFooter divider>
          <Button type="submit" disabled={isPending}>
            Save
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
