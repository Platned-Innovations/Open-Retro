"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { X } from "lucide-react";
import { Button, Select, Modal, ModalHeader, ModalTitle, ModalBody, ModalFooter, IconButton } from "@platned/ui";
import { assignUserToProject } from "@/server/actions/users";
import { removeProjectMember } from "@/server/actions/invitations";
import { useAction } from "@/lib/useAction";

type CompanyOption = { id: string; name: string; projects: { id: string; name: string }[] };
type CurrentProject = { id: string; name: string; companyName: string };

type Props = {
  onClose: () => void;
  userId: string;
  userName: string;
  companies: CompanyOption[];
  currentProjects: CurrentProject[];
};

/** Super Admin console: add/remove a user's project assignments across every company. */
export function ManageUserProjectsDialog({ onClose, userId, userName, companies, currentProjects }: Props) {
  const { run, isPending } = useAction();
  const [selected, setSelected] = useState("");

  const availableOptions = useMemo(() => {
    const assigned = new Set(currentProjects.map((p) => p.id));
    return companies.flatMap((c) =>
      c.projects.filter((p) => !assigned.has(p.id)).map((p) => ({ value: p.id, label: `${c.name} / ${p.name}` })),
    );
  }, [companies, currentProjects]);

  function addProject() {
    if (!selected) return;
    run(() => assignUserToProject(userId, selected), {
      onSuccess: () => {
        toast.success("Added to project");
        setSelected("");
      }
    });
  }

  function removeProject(projectId: string) {
    run(() => removeProjectMember(projectId, userId), {
      onSuccess: () => toast.success("Removed from project"),
    });
  }

  return (
    <Modal isOpen onClose={onClose} label={`Manage projects for ${userName}`} size="sm">
      <ModalHeader divider>
        <ModalTitle>Projects for {userName}</ModalTitle>
      </ModalHeader>
      <ModalBody>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            {currentProjects.length === 0 ? (
              <p className="text-body-sm text-default-secondary">Not on any projects yet.</p>
            ) : (
              currentProjects.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between rounded-md border border-default px-3 py-2"
                >
                  <span className="text-body-sm text-default">
                    {p.companyName} / {p.name}
                  </span>
                  <IconButton
                    aria-label={`Remove from ${p.name}`}
                    variant="subtle"
                    size="sm"
                    disabled={isPending}
                    onClick={() => removeProject(p.id)}
                  >
                    <X className="size-3.5" />
                  </IconButton>
                </div>
              ))
            )}
          </div>

          {availableOptions.length > 0 && (
            <div className="flex items-end gap-2">
              <Select
                label="Add to project"
                className="flex-1"
                options={[{ value: "", label: "Choose a project" }, ...availableOptions]}
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
              />
              <Button type="button" onClick={addProject} disabled={isPending || !selected}>
                Add
              </Button>
            </div>
          )}
        </div>
      </ModalBody>
      <ModalFooter divider align="end">
        <Button type="button" variant="neutral" onClick={onClose}>
          Done
        </Button>
      </ModalFooter>
    </Modal>
  );
}
