"use client";

import { useState } from "react";
import { Plus, Trash2, UserPlus } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  DropdownMenu,
  IconButton,
  Input,
  StatusBadge,
  type DropdownMenuItem,
} from "@platned/ui";
import {
  createActionItem,
  deleteActionItem,
  setActionItemStatus,
  updateActionItemAssignees,
} from "@/server/actions/retros";
import type { ActionItemWithRelations, ProjectMemberOption } from "@/server/queries/retros";
import { AssigneeInput } from "@/components/retro/assignee-input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { useAction } from "@/lib/useAction";
import {
  ACTION_STATUS_LABELS,
  ACTION_STATUS_ORDER,
  ACTION_STATUS_TONE,
  isOverdue,
  isUnresolved,
} from "@/lib/actionItems";
import type { ActionResult } from "@/types/action-result";
import { cn } from "@/lib/utils";

function ActionItemRow({
  retrospectiveId,
  item,
  members,
  onChanged,
}: {
  retrospectiveId: string;
  item: ActionItemWithRelations;
  members: ProjectMemberOption[];
  onChanged: (action: () => Promise<ActionResult<unknown>>) => void;
}) {
  const resolved = !isUnresolved(item.status);
  const overdue = isOverdue(item);

  const statusItems: DropdownMenuItem[] = ACTION_STATUS_ORDER.map((status) => ({
    label: ACTION_STATUS_LABELS[status],
    disabled: status === item.status,
    onSelect: () =>
      onChanged(() =>
        setActionItemStatus({ retrospectiveId, actionItemId: item.id, status }),
      ),
  }));

  return (
    <div className="group flex items-center gap-3 rounded-md p-1.5 hover:bg-default-secondary">
      {/* Fixed width, so the descriptions line up in a column instead of
          jagging as statuses change — "In progress" is twice the width of
          "Open". Wide enough for the longest label without wrapping it. */}
      <div className="w-28 shrink-0">
        <DropdownMenu
          items={statusItems}
          label={`Change status of "${item.description.slice(0, 30)}"`}
          trigger={
            <StatusBadge
              label={ACTION_STATUS_LABELS[item.status]}
              tone={ACTION_STATUS_TONE[item.status]}
              size="sm"
            />
          }
        />
      </div>
      <div className="flex flex-1 flex-wrap items-center gap-1.5 text-body-sm">
        <span className={cn(resolved && "text-default-secondary line-through")}>
          {item.description}
        </span>
        {item.assignees.map((a) => (
          <Badge key={a.id} label={`@${a.name}`} color="blue" size="sm" />
        ))}
        {item.dueDate && (
          <Badge
            label={format(item.dueDate, "MMM d")}
            color={overdue ? "red" : "gray"}
            size="sm"
          />
        )}
        {/* Carried once is normal; carried three times is the board telling you
            something a status alone cannot. */}
        {item.carriedCount > 0 && (
          <Badge
            label={item.carriedCount === 1 ? "carried over" : `carried ×${item.carriedCount}`}
            color={item.carriedCount > 2 ? "red" : "gray"}
            size="sm"
          />
        )}
        {item.sourceCard && (
          <span className="text-body-tiny text-default-secondary">
            from: {item.sourceCard.content.slice(0, 40)}
            {item.sourceCard.content.length > 40 ? "…" : ""}
          </span>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {/* Base UI's Popover, so the assignee editor gets a dialog role, focus
            management and Esc-to-close — none of which the hand-rolled
            outside-click listener it replaces provided. */}
        <Popover>
          <PopoverTrigger
            render={
              <IconButton
                variant="subtle"
                size="sm"
                aria-label={`Edit assignees for "${item.description.slice(0, 30)}"`}
                className="reveal-on-hover"
              />
            }
          >
            <UserPlus className="h-3.5 w-3.5" />
          </PopoverTrigger>
          <PopoverContent className="w-64 p-2" align="end">
            <AssigneeInput
              members={members}
              selectedIds={item.assignees.map((a) => a.id)}
              onChange={(ids) =>
                onChanged(() => updateActionItemAssignees(retrospectiveId, item.id, ids))
              }
            />
          </PopoverContent>
        </Popover>
        <IconButton
          variant="subtle"
          size="sm"
          aria-label="Delete action item"
          className="reveal-on-hover"
          onClick={() => onChanged(() => deleteActionItem(retrospectiveId, item.id))}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </IconButton>
      </div>
    </div>
  );
}

export function ActionItemsPanel({
  retrospectiveId,
  actionItems,
  members,
  draft,
  onDraftUsed,
}: {
  retrospectiveId: string;
  actionItems: ActionItemWithRelations[];
  members: ProjectMemberOption[];
  /** Seeded from the card under discussion, so nobody retypes what was just said. */
  draft?: string | null;
  onDraftUsed?: () => void;
}) {
  const { run } = useAction();

  return (
    <Card className="overflow-visible">
      <CardHeader>
        <CardTitle className="flex items-center gap-2" size="md">
          <span className="flex h-5 w-5 items-center justify-center rounded bg-positive-tertiary text-positive">
            ✓
          </span>
          Action items
        </CardTitle>
      </CardHeader>
      <CardBody className="gap-4">
        {actionItems.length === 0 && (
          <p className="text-body-sm text-default-secondary">
            Add 1-2 follow-up action items to help the team apply what they learned.
          </p>
        )}

        <div className="flex flex-col gap-2">
          {actionItems.map((item) => (
            <ActionItemRow
              key={item.id}
              retrospectiveId={retrospectiveId}
              item={item}
              members={members}
              onChanged={run}
            />
          ))}
        </div>

        {/* Keyed on the draft: a new one remounts the form with that text
            already in it. Resetting state with a key is React's own answer to
            "prop changed, reinitialise" — an effect that calls setState would
            do the same job less honestly, and only this form resets rather
            than the whole panel. */}
        <NewActionItemForm
          key={draft ?? ""}
          retrospectiveId={retrospectiveId}
          members={members}
          initialDescription={draft ?? ""}
          onSubmitted={onDraftUsed}
        />
      </CardBody>
    </Card>
  );
}

function NewActionItemForm({
  retrospectiveId,
  members,
  initialDescription,
  onSubmitted,
}: {
  retrospectiveId: string;
  members: ProjectMemberOption[];
  initialDescription: string;
  onSubmitted?: () => void;
}) {
  const [description, setDescription] = useState(initialDescription);
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [dueDate, setDueDate] = useState("");
  const { run, isPending } = useAction();

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!description.trim()) return;
    run(
      () =>
        createActionItem({
          retrospectiveId,
          description: description.trim(),
          assigneeIds,
          dueDate: dueDate ? new Date(dueDate) : undefined,
        }),
      {
        onSuccess: () => {
          setDescription("");
          setAssigneeIds([]);
          setDueDate("");
          onSubmitted?.();
        },
      },
    );
  }

  return (
    <form onSubmit={handleAdd} className="flex flex-wrap items-start gap-2 border-t border-default pt-4">
      <Input
        size="sm"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Add an action item…"
        className="min-w-40 flex-1"
        autoFocus={Boolean(initialDescription)}
      />
      <AssigneeInput
        members={members}
        selectedIds={assigneeIds}
        onChange={setAssigneeIds}
        placeholder="Assign to…"
        className="w-48"
      />
      <Input
        size="sm"
        type="date"
        value={dueDate}
        onChange={(e) => setDueDate(e.target.value)}
        className="w-36"
      />
      <Button type="submit" size="sm" disabled={isPending} leadingIcon={<Plus className="h-3.5 w-3.5" />}>
        Add
      </Button>
    </form>
  );
}
