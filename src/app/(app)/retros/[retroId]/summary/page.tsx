import { notFound } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import CardHeader from "@mui/material/CardHeader";
import CardContent from "@mui/material/CardContent";
import Chip, { type ChipProps } from "@mui/material/Chip";
import Avatar from "@mui/material/Avatar";
import { ArrowLeft, Download, Heart, ListTree, MessageSquareText } from "lucide-react";
import { getRetroBoard, getRelatedRetros } from "@/server/queries/retros";
import { getHealthSummary } from "@/server/retro/health";
import { HealthSummary } from "@/components/retro/health-summary";
import { NotFoundError } from "@/lib/authz";
import { ActionItemsPanel } from "@/components/retro/action-items-panel";
import { BreadcrumbNav } from "@/components/breadcrumb-nav";
import { NavLinkButton, NavLinkCardArea } from "@/components/mui/nav-link";
import { TEMPLATE_LABELS } from "@/lib/retroTemplates";
import { effectiveVoteCount } from "@/lib/retroVotes";
import { isUnresolved } from "@/lib/actionItems";

const STATUS_CHIP_COLOR: Record<string, ChipProps["color"]> = {
  DRAFT: "default",
  ACTIVE: "success",
  COMPLETED: "info",
  ARCHIVED: "default",
};

export default async function RetroSummaryPage({
  params,
}: {
  params: Promise<{ retroId: string }>;
}) {
  const { retroId } = await params;
  let retro;
  try {
    retro = await getRetroBoard(retroId);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }
  const related = await getRelatedRetros(retro.projectId, retroId);

  // The check-in is otherwise visible for the sixty seconds the board spends in
  // CHECK_IN and never again — insights need a second retrospective before they
  // show anything, so without this a team's first result is lost.
  const healthSummary = retro.checkInEnabled ? await getHealthSummary(retroId) : null;

  return (
    <Stack spacing={4}>
      <BreadcrumbNav
        items={[
          { label: retro.project.company.name, href: `/companies/${retro.project.companyId}` },
          { label: retro.project.name, href: `/projects/${retro.projectId}` },
          { label: retro.title },
        ]}
      />

      <Stack direction="row" sx={{ alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 2 }}>
        <Box>
          <NavLinkButton href={`/retros/${retro.id}`} size="small" startIcon={<ArrowLeft className="h-3.5 w-3.5" />} sx={{ ml: -1 }}>
            Back to board
          </NavLinkButton>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            {retro.title}
          </Typography>
          <Typography variant="body1" color="text.secondary">
            {TEMPLATE_LABELS[retro.template]} · Facilitated by {retro.facilitatorName} · {formatDistanceToNow(retro.createdAt, { addSuffix: true })}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}>
          {/* Plain links, not buttons: the response is a file, so the browser's
              own download handling is the whole mechanism — and it means an
              export can be bookmarked, shared or curl'd. */}
          <NavLinkButton href={`/api/retros/${retro.id}/export?format=md`} variant="outlined" size="small" startIcon={<Download className="h-3.5 w-3.5" />}>
            Markdown
          </NavLinkButton>
          <NavLinkButton href={`/api/retros/${retro.id}/export?format=csv`} variant="outlined" size="small" startIcon={<Download className="h-3.5 w-3.5" />}>
            Actions CSV
          </NavLinkButton>
          {retro.actionItems.some((item) => isUnresolved(item.status)) && (
            <Chip label={`${retro.actionItems.filter((item) => isUnresolved(item.status)).length} pending`} color="warning" size="small" />
          )}
          <Chip label={retro.status} color={STATUS_CHIP_COLOR[retro.status]} size="small" />
        </Stack>
      </Stack>

      {healthSummary && healthSummary.submitted > 0 && <HealthSummary summary={healthSummary} />}

      <ActionItemsPanel retrospectiveId={retro.id} actionItems={retro.actionItems} members={retro.assignableMembers} />

      <Box>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 1.5 }}>
          <ListTree className="h-4 w-4" />
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Board recap
          </Typography>
        </Stack>
        {/* Column count comes from the template, so a 4Ls or custom board gets
            its own columns rather than being wrapped into a hardcoded three. */}
        <Grid container spacing={2}>
          {retro.columns.map((column) => {
            // effectiveVoteCount folds in merged children, so a card that
            // three people raised separately outranks one that one person did.
            const topLevel = column.cards.filter((c) => !c.groupId).sort((a, b) => effectiveVoteCount(b) - effectiveVoteCount(a));
            return (
              <Grid key={column.id} size={{ xs: 12, sm: 6, md: 12 / Math.min(retro.columns.length, 4) }}>
                <Card variant="outlined" sx={{ height: "100%" }}>
                  <CardHeader
                    title={
                      <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                        <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: column.color }} />
                        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                          {column.title}
                        </Typography>
                      </Stack>
                    }
                  />
                  <CardContent sx={{ pt: 0 }}>
                    <Stack spacing={1}>
                      {topLevel.length === 0 && (
                        <Typography variant="body2" color="text.secondary">
                          No cards.
                        </Typography>
                      )}
                      {topLevel.map((card) => {
                        const authorName = card.authorName ?? "Anonymous";
                        return (
                          <Box key={card.id} sx={{ border: 1, borderColor: "divider", borderRadius: 1, p: 1.5 }}>
                            <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                              {card.content}
                            </Typography>
                            <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", mt: 1 }}>
                              <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
                                <Avatar sx={{ width: 18, height: 18, fontSize: 10 }}>{authorName.slice(0, 1).toUpperCase()}</Avatar>
                                <Typography variant="caption" color="text.secondary">
                                  {authorName}
                                  {card.grouped.length > 0 && ` · +${card.grouped.length} merged`}
                                </Typography>
                              </Stack>
                              <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                                {card.comments.length > 0 && (
                                  <Stack direction="row" spacing={0.25} sx={{ alignItems: "center", color: "text.secondary" }}>
                                    <MessageSquareText className="h-3 w-3" />
                                    <Typography variant="caption" color="text.secondary">
                                      {card.comments.length}
                                    </Typography>
                                  </Stack>
                                )}
                                <Stack direction="row" spacing={0.25} sx={{ alignItems: "center", color: "text.secondary" }}>
                                  <Heart className="h-3 w-3" />
                                  <Typography variant="caption" color="text.secondary">
                                    {effectiveVoteCount(card)}
                                  </Typography>
                                </Stack>
                              </Stack>
                            </Stack>
                          </Box>
                        );
                      })}
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      </Box>

      {related.length > 0 && (
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 1.5 }}>
            Related content
          </Typography>
          <Grid container spacing={2}>
            {related.map((r) => (
              <Grid key={r.id} size={{ xs: 12, sm: 6 }}>
                <Card variant="outlined">
                  <NavLinkCardArea href={`/retros/${r.id}/summary`} sx={{ p: 1.5 }}>
                    <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                      <ListTree className="h-3.5 w-3.5" style={{ opacity: 0.6 }} />
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        Retrospective: {r.title}
                      </Typography>
                    </Stack>
                    <Typography variant="caption" color="text.secondary">
                      {r.facilitator.name} · {formatDistanceToNow(r.createdAt, { addSuffix: true })}
                    </Typography>
                  </NavLinkCardArea>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      )}
    </Stack>
  );
}
