"use client";

import { useState } from "react";
import { format } from "date-fns";
import { History } from "lucide-react";
import Card from "@mui/material/Card";
import CardHeader from "@mui/material/CardHeader";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import { carryOverActionItems } from "@/server/actions/retros";
import { ACTION_STATUS_LABELS, ACTION_STATUS_CHIP_COLOR } from "@/lib/actionItems";
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
export function CarryOverPanel({ retrospectiveId, candidates }: { retrospectiveId: string; candidates: CarryOverCandidate[] }) {
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
    <Card variant="outlined">
      <CardHeader
        title={
          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            <History className="h-4 w-4" />
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              Unfinished from earlier retros
            </Typography>
          </Stack>
        }
      />
      <CardContent sx={{ pt: 0 }}>
        {candidates.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            Nothing outstanding from this project&apos;s earlier retrospectives.
          </Typography>
        ) : (
          <Stack spacing={2}>
            <Stack spacing={0.5}>
              {candidates.map((item) => (
                <FormControlLabel
                  key={item.id}
                  sx={{ alignItems: "flex-start", m: 0, borderRadius: 1, p: 0.5, "&:hover": { bgcolor: "action.hover" } }}
                  control={<Checkbox checked={selected.has(item.id)} onChange={() => toggle(item.id)} sx={{ mt: -0.5 }} />}
                  label={
                    <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", alignItems: "center" }}>
                      <Typography variant="body2">{item.description}</Typography>
                      <Chip label={ACTION_STATUS_LABELS[item.status]} color={ACTION_STATUS_CHIP_COLOR[item.status]} size="small" />
                      <Typography variant="caption" color="text.secondary">
                        from {item.retrospective.title}
                        {item.dueDate && ` · due ${format(item.dueDate, "MMM d")}`}
                        {item.assignees.length > 0 && ` · ${item.assignees.map((a) => a.user.name).join(", ")}`}
                      </Typography>
                      {item._count.carryOvers > 0 && (
                        <Chip
                          label={`already carried ×${item._count.carryOvers}`}
                          color={item._count.carryOvers > 2 ? "warning" : "default"}
                          size="small"
                          variant="outlined"
                        />
                      )}
                    </Stack>
                  }
                />
              ))}
            </Stack>

            <Button
              variant="contained"
              size="small"
              sx={{ alignSelf: "flex-start" }}
              disabled={selected.size === 0 || isPending}
              onClick={() =>
                run(() => carryOverActionItems({ retrospectiveId, actionItemIds: [...selected] }), {
                  onSuccess: () => setSelected(new Set()),
                })
              }
            >
              {selected.size === 0 ? "Carry over" : `Carry over ${selected.size} item${selected.size === 1 ? "" : "s"}`}
            </Button>
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}
