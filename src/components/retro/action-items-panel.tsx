"use client";

import { useState, type MouseEvent } from "react";
import { format } from "date-fns";
import { Plus, Trash2, UserPlus } from "lucide-react";
import Card from "@mui/material/Card";
import CardHeader from "@mui/material/CardHeader";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import TextField from "@mui/material/TextField";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Popover from "@mui/material/Popover";
import CheckCircleIcon from "@mui/icons-material/CheckCircleOutlined";
import {
  createActionItem,
  deleteActionItem,
  setActionItemStatus,
  updateActionItemAssignees,
} from "@/server/actions/retros";
import type { ActionItemWithRelations, ProjectMemberOption } from "@/server/queries/retros";
import { AssigneeInput } from "@/components/retro/assignee-input";
import { useAction } from "@/lib/useAction";
import { ACTION_STATUS_LABELS, ACTION_STATUS_ORDER, ACTION_STATUS_CHIP_COLOR, isOverdue, isUnresolved } from "@/lib/actionItems";
import type { ActionResult } from "@/types/action-result";

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
  const [statusAnchor, setStatusAnchor] = useState<null | HTMLElement>(null);
  const [assigneeAnchor, setAssigneeAnchor] = useState<null | HTMLElement>(null);

  return (
    <Stack
      direction="row"
      spacing={1.5}
      className="group"
      sx={{ alignItems: "center", borderRadius: 1, p: 0.75, "&:hover": { bgcolor: "action.hover" } }}
    >
      {/* Fixed width, so the descriptions line up in a column instead of
          jagging as statuses change — "In progress" is twice the width of
          "Open". Wide enough for the longest label without wrapping it. */}
      <Box sx={{ width: 96, flexShrink: 0 }}>
        <Chip
          label={ACTION_STATUS_LABELS[item.status]}
          color={ACTION_STATUS_CHIP_COLOR[item.status]}
          size="small"
          onClick={(e: MouseEvent<HTMLElement>) => setStatusAnchor(e.currentTarget)}
          aria-label={`Change status of "${item.description.slice(0, 30)}"`}
        />
        <Menu anchorEl={statusAnchor} open={Boolean(statusAnchor)} onClose={() => setStatusAnchor(null)}>
          {ACTION_STATUS_ORDER.map((status) => (
            <MenuItem
              key={status}
              disabled={status === item.status}
              onClick={() => {
                setStatusAnchor(null);
                onChanged(() => setActionItemStatus({ retrospectiveId, actionItemId: item.id, status }));
              }}
            >
              {ACTION_STATUS_LABELS[status]}
            </MenuItem>
          ))}
        </Menu>
      </Box>
      <Stack direction="row" spacing={1} sx={{ flex: 1, flexWrap: "wrap", alignItems: "center" }}>
        <Typography
          variant="body2"
          sx={resolved ? { color: "text.secondary", textDecoration: "line-through" } : undefined}
        >
          {item.description}
        </Typography>
        {item.assignees.map((a) => (
          <Chip key={a.id} label={`@${a.name}`} size="small" color="primary" variant="outlined" />
        ))}
        {item.dueDate && <Chip label={format(item.dueDate, "MMM d")} size="small" color={overdue ? "error" : "default"} />}
        {/* Carried once is normal; carried three times is the board telling you
            something a status alone cannot. */}
        {item.carriedCount > 0 && (
          <Chip
            label={item.carriedCount === 1 ? "carried over" : `carried ×${item.carriedCount}`}
            size="small"
            color={item.carriedCount > 2 ? "error" : "default"}
          />
        )}
        {item.sourceCard && (
          <Typography variant="caption" color="text.secondary">
            from: {item.sourceCard.content.slice(0, 40)}
            {item.sourceCard.content.length > 40 ? "…" : ""}
          </Typography>
        )}
      </Stack>
      <Stack direction="row" spacing={0.5} sx={{ flexShrink: 0 }} className="reveal-on-hover">
        <IconButton
          size="small"
          aria-label={`Edit assignees for "${item.description.slice(0, 30)}"`}
          onClick={(e: MouseEvent<HTMLElement>) => setAssigneeAnchor(e.currentTarget)}
        >
          <UserPlus className="h-3.5 w-3.5" />
        </IconButton>
        <Popover
          open={Boolean(assigneeAnchor)}
          anchorEl={assigneeAnchor}
          onClose={() => setAssigneeAnchor(null)}
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
          transformOrigin={{ vertical: "top", horizontal: "right" }}
        >
          <Box sx={{ p: 1.5, width: 256 }}>
            <AssigneeInput
              members={members}
              selectedIds={item.assignees.map((a) => a.id)}
              onChange={(ids) => onChanged(() => updateActionItemAssignees(retrospectiveId, item.id, ids))}
            />
          </Box>
        </Popover>
        <IconButton size="small" aria-label="Delete action item" onClick={() => onChanged(() => deleteActionItem(retrospectiveId, item.id))}>
          <Trash2 className="h-3.5 w-3.5" />
        </IconButton>
      </Stack>
    </Stack>
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
    <Card variant="outlined">
      <CardHeader
        title={
          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            <CheckCircleIcon fontSize="small" color="success" />
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              Action items
            </Typography>
          </Stack>
        }
      />
      <CardContent sx={{ pt: 0 }}>
        <Stack spacing={2}>
          {actionItems.length === 0 && (
            <Typography variant="body2" color="text.secondary">
              Add 1-2 follow-up action items to help the team apply what they learned.
            </Typography>
          )}

          <Stack spacing={0.5}>
            {actionItems.map((item) => (
              <ActionItemRow key={item.id} retrospectiveId={retrospectiveId} item={item} members={members} onChanged={run} />
            ))}
          </Stack>

          {/* Keyed on the draft: a new one remounts the form with that text
              already in it. Resetting state with a key is React's own answer to
              "prop changed, reinitialise" — an effect that calls setState would
              do the same job less honestly, and only this form resets rather
              than the whole panel. */}
          <NewActionItemForm key={draft ?? ""} retrospectiveId={retrospectiveId} members={members} initialDescription={draft ?? ""} onSubmitted={onDraftUsed} />
        </Stack>
      </CardContent>
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
    <Stack
      component="form"
      onSubmit={handleAdd}
      direction="row"
      spacing={1.5}
      sx={{ flexWrap: "wrap", alignItems: "flex-start", borderTop: 1, borderColor: "divider", pt: 2 }}
    >
      <TextField
        size="small"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Add an action item…"
        autoFocus={Boolean(initialDescription)}
        sx={{ minWidth: 160, flex: 1 }}
      />
      <AssigneeInput members={members} selectedIds={assigneeIds} onChange={setAssigneeIds} placeholder="Assign to…" className="w-48" />
      <TextField size="small" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} sx={{ width: 160 }} />
      <Button type="submit" variant="contained" size="small" disabled={isPending} startIcon={<Plus className="h-3.5 w-3.5" />}>
        Add
      </Button>
    </Stack>
  );
}
