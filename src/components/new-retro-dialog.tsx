"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, X } from "lucide-react";
import {
  Button,
  IconButton,
  Input,
  Select,
  Checkbox,
  Modal,
  ModalHeader,
  ModalTitle,
  ModalDescription,
  ModalBody,
  ModalFooter,
} from "@platned/ui";
import { createRetrospective } from "@/server/actions/retros";
import { TEMPLATE_LABELS } from "@/lib/retroTemplates";
import type { RetroTemplate } from "@/generated/prisma/client";

const TEMPLATES = Object.keys(TEMPLATE_LABELS) as RetroTemplate[];
const TEMPLATE_OPTIONS = TEMPLATES.map((t) => ({ value: t, label: TEMPLATE_LABELS[t] }));

export function NewRetroDialog({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [template, setTemplate] = useState<RetroTemplate>("START_STOP_CONTINUE");
  const [customColumns, setCustomColumns] = useState<string[]>(["", ""]);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isGuided, setIsGuided] = useState(true);
  const [hideOthersCards, setHideOthersCards] = useState(true);
  const [voteBudget, setVoteBudget] = useState("5");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        const result = await createRetrospective({
          projectId,
          title,
          template,
          customColumns: template === "CUSTOM" ? customColumns.filter(Boolean) : undefined,
          isAnonymous,
          isGuided,
          hideOthersCards,
          voteBudget: Number(voteBudget),
        });
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        setOpen(false);
        router.push(`/retros/${result.data.id}`);
      } catch {
        toast.error("Couldn't reach the server. Check your connection and try again.");
      }
    });
  }

  return (
    <>
      <Button size="md" onClick={() => setOpen(true)} leadingIcon={<Plus className="h-4 w-4" />}>
        New retrospective
      </Button>
      <Modal isOpen={open} onClose={() => setOpen(false)} label="New retrospective" size="sm">
        <form onSubmit={handleSubmit}>
          <ModalHeader divider>
            <ModalTitle>New retrospective</ModalTitle>
            <ModalDescription>Pick a format for the board.</ModalDescription>
          </ModalHeader>
          <ModalBody>
            <div className="flex flex-col gap-4">
              <Input
                label="Title"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Sprint 42 Retrospective"
              />
              <Select
                label="Template"
                options={TEMPLATE_OPTIONS}
                value={template}
                onChange={(e) => setTemplate(e.target.value as RetroTemplate)}
              />

              {template === "CUSTOM" && (
                <div className="flex flex-col gap-2">
                  <span className="text-body-sm font-medium text-default">Columns</span>
                  {customColumns.map((col, i) => (
                    <div key={i} className="flex gap-2">
                      <Input
                        value={col}
                        onChange={(e) =>
                          setCustomColumns((cols) => cols.map((c, idx) => (idx === i ? e.target.value : c)))
                        }
                        placeholder={`Column ${i + 1}`}
                        className="flex-1"
                      />
                      <IconButton
                        type="button"
                        variant="neutral"
                        aria-label={`Remove column ${i + 1}`}
                        onClick={() => setCustomColumns((cols) => cols.filter((_, idx) => idx !== i))}
                      >
                        <X className="h-4 w-4" />
                      </IconButton>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="neutral"
                    size="sm"
                    onClick={() => setCustomColumns((cols) => [...cols, ""])}
                  >
                    Add column
                  </Button>
                </div>
              )}

              <Checkbox
                checked={isAnonymous}
                onChange={setIsAnonymous}
                label="Anonymous cards (hide who wrote each card)"
              />

              <Checkbox
                checked={isGuided}
                onChange={setIsGuided}
                label="Guided session (step the group through collect, group, vote, discuss)"
              />

              {/* Only meaningful inside a guided session — without phases there
                  is no COLLECT to hide during, and no VOTE to budget. */}
              {isGuided && (
                <div className="flex flex-col gap-3 border-l-2 border-default pl-4">
                  <Checkbox
                    checked={hideOthersCards}
                    onChange={setHideOthersCards}
                    label="Hide other people's cards while collecting (avoids anchoring)"
                  />
                  <Select
                    label="Votes per person"
                    options={[
                      { value: "0", label: "Unlimited" },
                      { value: "3", label: "3 votes" },
                      { value: "5", label: "5 votes" },
                      { value: "7", label: "7 votes" },
                    ]}
                    value={voteBudget}
                    onChange={(e) => setVoteBudget(e.target.value)}
                  />
                </div>
              )}
            </div>
          </ModalBody>
          <ModalFooter divider>
            <Button type="submit" disabled={isPending}>
              Start retrospective
            </Button>
          </ModalFooter>
        </form>
      </Modal>
    </>
  );
}
