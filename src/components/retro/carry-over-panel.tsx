"use client";

import { useState } from "react";
import { format } from "date-fns";
import { History } from "lucide-react";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Checkbox,
  EmptyState,
  StatusBadge,
} from "@platned/ui";
import { carryOverActionItems } from "@/server/actions/retros";
import { ACTION_STATUS_LABELS, ACTION_STATUS_TONE } from "@/lib/actionItems";
import { useAction } from "@/lib/useAction";
import type { CarryOverCandidate } from "@/server/queries/retros";

/**
 * Unresolved work from earlier retros in this project.
 *
 * The point of a retrospective is the change it produces, and an action item
 * nobody looks at again produces none. Pulling the outstanding ones onto the
 * new board — by reference, so there is still only one of each — is what turns
 * a list of good intentions into something the team has to answer for.
 */
export function CarryOverPanel({
  retrospectiveId,
  candidates,
}: {
  retrospectiveId: string;
  candidates: CarryOverCandidate[];
}) {
  const { run, isPending } = useAction();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <Card className="overflow-visible">
      <CardHeader>
        <CardTitle size="md" className="flex items-center gap-2">
          <History className="h-4 w-4" />
          Unfinished from earlier retros
        </CardTitle>
      </CardHeader>
      <CardBody className="gap-3">
        {candidates.length === 0 ? (
          <EmptyState message="Nothing outstanding from this project's earlier retrospectives." />
        ) : (
          <>
            <div className="flex flex-col gap-1">
              {candidates.map((item) => (
                <label
                  key={item.id}
                  className="flex cursor-pointer items-start gap-2 rounded-md p-1.5 hover:bg-default-secondary"
                >
                  <Checkbox
                    checked={selected.has(item.id)}
                    onChange={() => toggle(item.id)}
                    className="mt-0.5"
                  />
                  <span className="flex flex-1 flex-wrap items-center gap-1.5 text-body-sm">
                    <span className="text-default">{item.description}</span>
                    <StatusBadge
                      label={ACTION_STATUS_LABELS[item.status]}
                      tone={ACTION_STATUS_TONE[item.status]}
                      size="sm"
                    />
                    <span className="text-body-tiny text-default-secondary">
                      from {item.retrospective.title}
                      {item.dueDate && ` · due ${format(item.dueDate, "MMM d")}`}
                      {item.assignees.length > 0 &&
                        ` · ${item.assignees.map((a) => a.user.name).join(", ")}`}
                    </span>
                    {item._count.carryOvers > 0 && (
                      <StatusBadge
                        label={`already carried ×${item._count.carryOvers}`}
                        tone={item._count.carryOvers > 2 ? "warning" : "neutral"}
                        size="sm"
                      />
                    )}
                  </span>
                </label>
              ))}
            </div>

            <Button
              size="sm"
              disabled={selected.size === 0 || isPending}
              onClick={() =>
                run(
                  () =>
                    carryOverActionItems({
                      retrospectiveId,
                      actionItemIds: [...selected],
                    }),
                  { onSuccess: () => setSelected(new Set()) },
                )
              }
            >
              {selected.size === 0
                ? "Carry over"
                : `Carry over ${selected.size} item${selected.size === 1 ? "" : "s"}`}
            </Button>
          </>
        )}
      </CardBody>
    </Card>
  );
}
