"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button, Input, Textarea, Modal, ModalHeader, ModalTitle, ModalDescription, ModalBody, ModalFooter } from "@platned/ui";
import { createProject } from "@/server/actions/projects";
import { useAction } from "@/lib/useAction";

export function NewProjectDialog({ companyId, companyName }: { companyId: string; companyName: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const { run, isPending } = useAction();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    run(() => createProject({ companyId, name, description: description || undefined }), {
      onSuccess: () => {
        toast.success(`Project "${name}" created`);
        setOpen(false);
        setName("");
        setDescription("");
      },
    });
  }

  return (
    <>
      <Button variant="neutral" size="md" onClick={() => setOpen(true)} leadingIcon={<Plus className="h-4 w-4" />}>
        New project
      </Button>
      <Modal isOpen={open} onClose={() => setOpen(false)} label={`New project in ${companyName}`} size="sm">
        <form onSubmit={handleSubmit}>
          <ModalHeader divider>
            <ModalTitle>New project in {companyName}</ModalTitle>
            <ModalDescription>Any member of {companyName} can create additional projects.</ModalDescription>
          </ModalHeader>
          <ModalBody>
            <div className="flex flex-col gap-4">
              <Input label="Project name" required value={name} onChange={(e) => setName(e.target.value)} />
              <Textarea
                label="Description (optional)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </ModalBody>
          <ModalFooter divider>
            <Button type="submit" disabled={isPending}>
              Create project
            </Button>
          </ModalFooter>
        </form>
      </Modal>
    </>
  );
}
