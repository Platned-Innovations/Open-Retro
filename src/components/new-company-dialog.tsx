"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Building2 } from "lucide-react";
import { Button, Input, Modal, ModalHeader, ModalTitle, ModalDescription, ModalBody, ModalFooter } from "@platned/ui";
import { createProject } from "@/server/actions/projects";
import { useAction } from "@/lib/useAction";

/** Super Admin only: defining a brand new company happens by creating its first project. */
export function NewCompanyDialog() {
  const [open, setOpen] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [projectName, setProjectName] = useState("");
  const { run, isPending } = useAction();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    run(() => createProject({ newCompanyName: companyName, name: projectName }), {
      onSuccess: () => {
        toast.success(`${companyName} created with project "${projectName}"`);
        setOpen(false);
        setCompanyName("");
        setProjectName("");
      },
    });
  }

  return (
    <>
      <Button size="md" onClick={() => setOpen(true)} leadingIcon={<Building2 className="h-4 w-4" />}>
        New company
      </Button>
      <Modal isOpen={open} onClose={() => setOpen(false)} label="New company" size="sm">
        <form onSubmit={handleSubmit}>
          <ModalHeader divider>
            <ModalTitle>New company</ModalTitle>
            <ModalDescription>Every company needs at least one project to start with.</ModalDescription>
          </ModalHeader>
          <ModalBody>
            <div className="flex flex-col gap-4">
              <Input
                label="Company name"
                required
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
              />
              <Input
                label="First project name"
                required
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
              />
            </div>
          </ModalBody>
          <ModalFooter divider>
            <Button type="submit" disabled={isPending}>
              Create company
            </Button>
          </ModalFooter>
        </form>
      </Modal>
    </>
  );
}
