"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Chip, { type ChipProps } from "@mui/material/Chip";
import Button from "@mui/material/Button";
import { RetroColumn } from "@/components/retro/retro-column";
import { PhaseBar } from "@/components/retro/phase-bar";
import { DiscussionFocus } from "@/components/retro/discussion-focus";
import { CarryOverPanel } from "@/components/retro/carry-over-panel";
import { HealthCheckIn } from "@/components/retro/health-check-in";
import { HealthSummary } from "@/components/retro/health-summary";
import { ActionItemsPanel } from "@/components/retro/action-items-panel";
import { RetroTimer } from "@/components/retro/retro-timer";
import { PresenceAvatars } from "@/components/retro/presence-avatars";
import { LiveCursors } from "@/components/retro/live-cursors";
import { BreadcrumbNav } from "@/components/breadcrumb-nav";
import { NavLinkButton } from "@/components/mui/nav-link";
import { DeleteConfirmButton } from "@/components/delete-confirm-button";
import { moveCard, setRetroStatus, deleteRetrospective } from "@/server/actions/retros";
import type { RetroBoard as RetroBoardData, CarryOverCandidate } from "@/server/queries/retros";
import type { HealthSummary as HealthSummaryData } from "@/server/retro/health";
import { TEMPLATE_LABELS } from "@/lib/retroTemplates";
import { PHASE_HINTS, PHASE_LABELS, canInPhase, type RetroCapability } from "@/lib/retroPhases";
import { isUnresolved } from "@/lib/actionItems";
import { useRetroSocket } from "@/lib/socket/useRetroSocket";
import { useAction } from "@/lib/useAction";
import { EyeOff, FileText, Link2, Lock, LockOpen } from "lucide-react";

const STATUS_CHIP_COLOR: Record<string, ChipProps["color"]> = {
  DRAFT: undefined,
  ACTIVE: "success",
  COMPLETED: "info",
  ARCHIVED: undefined,
};

export function RetroBoardView({
  retro,
  currentUserId,
  carryOverCandidates,
  healthSummary,
}: {
  retro: RetroBoardData;
  currentUserId: string;
  /** Only loaded for the phases where carrying work forward is the task at hand. */
  carryOverCandidates?: CarryOverCandidate[];
  /** Only loaded during CHECK_IN; already suppressed to what this room may see. */
  healthSummary?: HealthSummaryData;
}) {
  const { canModerate, canDelete } = retro.viewer;
  const router = useRouter();
  const { run, isPending } = useAction();
  // A pointer sensor alone means the board can only be rearranged with a mouse.
  // dnd-kit ships a keyboard one; `sortableKeyboardCoordinates` is what makes
  // the arrow keys move a card between siblings rather than by raw pixels.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const boardRef = useRef<HTMLDivElement>(null);
  const pendingActionItems = retro.actionItems.filter((item) => isUnresolved(item.status)).length;

  // Read from the same table the server enforces, so the UI never offers an
  // action that is about to be refused. Moderators keep their bypass.
  const writable = retro.status === "ACTIVE" || canModerate;
  const allow = (capability: RetroCapability) => writable && (canModerate || canInPhase(capability, retro));

  const canAddCards = allow("createCard");
  const canMoveCards = allow("moveCard");
  const canVote = allow("vote");
  const canComment = allow("comment");
  const canReact = allow("react");

  /** Why a column can't take new cards, so it explains itself rather than just refusing. */
  const closedReason = !writable
    ? "This retrospective is closed to new cards"
    : !canAddCards
      ? `${PHASE_LABELS[retro.phase]} is in progress — collecting has finished for now`
      : null;

  // Feeds the card menu's "Move to…" items, which are the only way to move a
  // card without a mouse — a phone has no drag, and dragging with a keyboard
  // is possible but fiddly. Counted here once rather than per card.
  const columnTargets = retro.columns.map((column) => ({
    id: column.id,
    title: column.title,
    cardCount: column.cards.filter((card) => !card.groupId).length,
  }));

  // Prefills the action-item form from the card under discussion, so capturing
  // an action doesn't mean retyping what was just said.
  const [actionItemDraft, setActionItemDraft] = useState<string | null>(null);

  // Any board change broadcast by another participant (or another tab of our
  // own) triggers a re-read of this Server Component's data. `viewers` and
  // `cursors` update live without ever touching the database.
  const { viewers, cursors, emitCursor } = useRetroSocket(retro.id, (message) => {
    // A phase change rearranges what everyone can do, so it is announced rather
    // than left to be noticed. This is the one event whose payload is read —
    // which is exactly why it carries a scalar and not a row.
    if (message.event === "phase:change" && message.payload.phase !== retro.phase) {
      toast.info(`${PHASE_LABELS[message.payload.phase]} — ${PHASE_HINTS[message.payload.phase]}`);
    }
    router.refresh();
  });

  // `getBoundingClientRect` forces a layout, and this ran on every single
  // pointer move. Measure once and re-measure only when the geometry can
  // actually have changed.
  const boardRectRef = useRef<DOMRect | null>(null);
  useEffect(() => {
    const measure = () => {
      boardRectRef.current = boardRef.current?.getBoundingClientRect() ?? null;
    };
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, []);

  function handleBoardMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const rect = boardRectRef.current;
    if (!rect || rect.width === 0 || rect.height === 0) return;
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    emitCursor(Math.max(0, Math.min(100, x)), Math.max(0, Math.min(100, y)));
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    // Gated on the capability rather than the status, so a guided retro allows
    // dragging during GROUP and nowhere else — and a moderator fixing the board
    // after it closes isn't blocked by a stale status check.
    if (!over || !canMoveCards) return;

    const cardId = String(active.id);
    const overId = String(over.id);

    const fromColumn = retro.columns.find((col) => col.cards.some((c) => c.id === cardId));
    if (!fromColumn) return;

    const overColumn = retro.columns.find((col) => col.id === overId);
    let toColumnId: string;
    let toIndex: number;

    if (overColumn) {
      toColumnId = overColumn.id;
      toIndex = overColumn.cards.filter((c) => !c.groupId).length;
    } else {
      const overCardColumn = retro.columns.find((col) => col.cards.some((c) => c.id === overId));
      if (!overCardColumn) return;
      toColumnId = overCardColumn.id;
      toIndex = overCardColumn.cards.filter((c) => !c.groupId).findIndex((c) => c.id === overId);
    }

    const currentIndex = fromColumn.cards.filter((c) => !c.groupId).findIndex((c) => c.id === cardId);
    if (toColumnId === fromColumn.id && toIndex === currentIndex) return;

    run(() => moveCard({ retrospectiveId: retro.id, cardId, toColumnId, toIndex }));
  }

  async function handleCopyLink() {
    const url = window.location.href;
    let copied = false;
    try {
      await navigator.clipboard.writeText(url);
      copied = true;
    } catch {
      // Clipboard API needs a secure context (or permission) that isn't
      // always available — fall back to the old select-and-copy trick.
      const textarea = document.createElement("textarea");
      textarea.value = url;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      copied = document.execCommand("copy");
      textarea.remove();
    }
    // Only claim success when something actually reached the clipboard —
    // otherwise the user walks away believing they have the link.
    if (copied) toast.success("Link copied");
    else toast.error("Couldn't copy the link — copy it from the address bar");
  }

  function handleToggleStatus() {
    const next = retro.status === "COMPLETED" ? "ACTIVE" : "COMPLETED";
    run(() => setRetroStatus(retro.id, next));
  }

  return (
    <Box
      ref={boardRef}
      sx={{ position: "relative", display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}
      onMouseMove={handleBoardMouseMove}
    >
      <BreadcrumbNav
        items={[
          { label: retro.project.company.name, href: `/companies/${retro.project.companyId}` },
          { label: retro.project.name, href: `/projects/${retro.projectId}` },
          { label: retro.title },
        ]}
      />

      <Stack spacing={1.5}>
        <Stack spacing={0.5}>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>
              {retro.title}
            </Typography>
            <Chip label={retro.status} color={STATUS_CHIP_COLOR[retro.status]} size="small" />
            {pendingActionItems > 0 && <Chip label={`${pendingActionItems} pending`} color="warning" size="small" variant="outlined" />}
            {retro.isAnonymous && <Chip label="Anonymous" icon={<EyeOff className="h-3 w-3" />} size="small" variant="outlined" />}
          </Stack>
          <Typography variant="body1" color="text.secondary">
            {TEMPLATE_LABELS[retro.template]} · Facilitated by {retro.facilitatorName}
          </Typography>
        </Stack>

        <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", flexWrap: "wrap" }}>
          <PresenceAvatars viewers={viewers} currentUserId={currentUserId} />
          <RetroTimer retrospectiveId={retro.id} timerEndsAt={retro.timerEndsAt} canModerate={canModerate} />
          <Button variant="outlined" size="small" onClick={handleCopyLink} startIcon={<Link2 className="h-3.5 w-3.5" />}>
            Copy link
          </Button>
          <NavLinkButton href={`/retros/${retro.id}/summary`} variant="outlined" size="small" startIcon={<FileText className="h-3.5 w-3.5" />}>
            Summary
          </NavLinkButton>
          {canModerate && (
            <Button
              variant="outlined"
              size="small"
              disabled={isPending}
              onClick={handleToggleStatus}
              startIcon={retro.status === "COMPLETED" ? <LockOpen className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
            >
              {retro.status === "COMPLETED" ? "Reopen" : "Complete retrospective"}
            </Button>
          )}
          {canDelete && (
            <DeleteConfirmButton
              label="Delete"
              title="Delete this retrospective?"
              description={`"${retro.title}" and every card, vote, comment, and action item on it will be permanently deleted. This can't be undone.`}
              action={deleteRetrospective}
              id={retro.id}
              redirectTo={`/projects/${retro.projectId}`}
              size="medium"
            />
          )}
        </Stack>
      </Stack>

      {retro.isGuided && <PhaseBar retro={retro} />}

      {carryOverCandidates && carryOverCandidates.length > 0 && canModerate && (
        <CarryOverPanel retrospectiveId={retro.id} candidates={carryOverCandidates} />
      )}

      {healthSummary && (
        <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" } }}>
          <HealthCheckIn retrospectiveId={retro.id} mine={healthSummary.mine} />
          <HealthSummary summary={healthSummary} />
        </Box>
      )}

      {retro.isGuided && retro.phase === "DISCUSS" && <DiscussionFocus retro={retro} onCreateActionItem={setActionItemDraft} />}

      <DndContext id={`retro-${retro.id}`} sensors={sensors} onDragEnd={handleDragEnd}>
        {/* grid, not flex: auto-cols lets each column stretch to share the full
            row width evenly (matching the Action items panel below) when
            there's room, while still falling back to horizontal scroll once
            there are more columns than fit at their 18rem floor. */}
        <Box
          sx={{
            display: "grid",
            gridAutoFlow: "column",
            gridAutoColumns: "minmax(18rem, 1fr)",
            gap: 2,
            overflowX: "auto",
            minWidth: 0,
            pb: 1,
          }}
        >
          {retro.columns.map((column) => (
            <RetroColumn
              key={column.id}
              retrospectiveId={retro.id}
              column={column}
              topLevelCards={column.cards.filter((c) => !c.groupId)}
              canModerate={canModerate}
              canAddCards={canAddCards}
              canVote={canVote}
              canComment={canComment}
              canReact={canReact}
              canMoveCards={canMoveCards}
              columnTargets={columnTargets}
              discussCardId={retro.discussCardId}
              closedReason={closedReason}
            />
          ))}
        </Box>
      </DndContext>

      <ActionItemsPanel
        draft={actionItemDraft}
        onDraftUsed={() => setActionItemDraft(null)}
        retrospectiveId={retro.id}
        actionItems={retro.actionItems}
        members={retro.assignableMembers}
      />

      <LiveCursors cursors={cursors} />
    </Box>
  );
}
