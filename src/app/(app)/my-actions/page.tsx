import { format } from "date-fns";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Card from "@mui/material/Card";
import Divider from "@mui/material/Divider";
import ChecklistIcon from "@mui/icons-material/Checklist";
import {
  listMyActionItems,
  listMyActionProjects,
  type MyActionItem,
} from "@/server/queries/myActions";
import { MyActionStatus } from "@/components/actions/my-action-row";
import { NavLinkChip, NavLinkText } from "@/components/mui/nav-link";
import { UNRESOLVED_STATUSES, isOverdue } from "@/lib/actionItems";
import type { ActionItemStatus } from "@/generated/prisma/client";

/**
 * Everything assigned to me, across every project.
 *
 * The tool has been emailing people about action items since the beginning
 * while giving them nowhere to see them — you could only find your own work by
 * remembering which retro it came out of. This is that page.
 *
 * Filters go through searchParams rather than client state, so the whole thing
 * stays a Server Component and a filtered view is a shareable URL.
 */
export default async function MyActionsPage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string; show?: string }>;
}) {
  const { projectId, show } = await searchParams;
  const showAll = show === "all";

  const [items, projects] = await Promise.all([
    listMyActionItems({
      projectId,
      status: showAll ? undefined : [...UNRESOLVED_STATUSES],
    }),
    listMyActionProjects(),
  ]);

  const byProject = new Map<string, { name: string; companyName: string; items: MyActionItem[] }>();
  for (const item of items) {
    const project = item.retrospective.project;
    const group = byProject.get(project.id) ?? {
      name: project.name,
      companyName: project.company.name,
      items: [],
    };
    group.items.push(item);
    byProject.set(project.id, group);
  }

  const query = (next: { projectId?: string; show?: string }) => {
    const params = new URLSearchParams();
    const nextProject = "projectId" in next ? next.projectId : projectId;
    const nextShow = "show" in next ? next.show : show;
    if (nextProject) params.set("projectId", nextProject);
    if (nextShow) params.set("show", nextShow);
    const qs = params.toString();
    return qs ? `/my-actions?${qs}` : "/my-actions";
  };

  return (
    <Stack spacing={4}>
      <Box>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          My action items
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Everything assigned to you, across every project.
        </Typography>
      </Box>

      <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", alignItems: "center" }}>
        <NavLinkChip
          href={query({ show: showAll ? undefined : "all" })}
          label={showAll ? "Show outstanding only" : "Include finished"}
          variant="outlined"
        />
        <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
        <NavLinkChip
          href={query({ projectId: undefined })}
          label="All projects"
          color="primary"
          variant={projectId ? "outlined" : "filled"}
        />
        {projects.map((project) => (
          <NavLinkChip
            key={project.id}
            href={query({ projectId: project.id })}
            label={project.name}
            color="primary"
            variant={projectId === project.id ? "filled" : "outlined"}
          />
        ))}
      </Stack>

      {items.length === 0 ? (
        <Stack spacing={1.5} sx={{ py: 8, alignItems: "center", color: "text.secondary" }}>
          <ChecklistIcon sx={{ fontSize: 40, opacity: 0.5 }} />
          <Typography variant="body1" color="text.secondary">
            {showAll
              ? "Nothing has been assigned to you yet."
              : 'Nothing outstanding. Anything finished is hidden — use "Include finished" to see it.'}
          </Typography>
        </Stack>
      ) : (
        <Stack spacing={3}>
          {[...byProject.entries()].map(([id, group]) => (
            <Box key={id}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                {group.name}
                <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                  {group.companyName}
                </Typography>
              </Typography>
              <Stack spacing={1.5} sx={{ mt: 1 }}>
                {group.items.map((item) => (
                  <ActionRow key={item.id} item={item} />
                ))}
              </Stack>
            </Box>
          ))}
        </Stack>
      )}
    </Stack>
  );
}

const STATUS_BORDER_COLOR: Record<ActionItemStatus, string> = {
  OPEN: "grey.400",
  IN_PROGRESS: "info.main",
  BLOCKED: "warning.main",
  DONE: "success.main",
  DROPPED: "grey.300",
};

function ActionRow({ item }: { item: MyActionItem }) {
  const overdue = isOverdue({ dueDate: item.dueDate, status: item.status as ActionItemStatus });

  return (
    <Card
      variant="outlined"
      sx={{ borderLeft: 4, borderLeftColor: overdue ? "error.main" : STATUS_BORDER_COLOR[item.status], p: 2 }}
    >
      <Stack direction="row" sx={{ alignItems: "flex-start", justifyContent: "space-between", gap: 2 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="body1" sx={{ fontWeight: 500 }}>
            {item.description}
          </Typography>
          <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", alignItems: "center", mt: 0.75 }}>
            <NavLinkText
              href={`/retros/${item.retrospective.id}`}
              variant="body2"
              color="text.secondary"
              sx={{ textDecoration: "none", "&:hover": { color: "primary.main" } }}
            >
              {item.retrospective.title}
            </NavLinkText>
            {item.dueDate && (
              <Chip
                label={`Due ${format(item.dueDate, "MMM d")}`}
                color={overdue ? "error" : "default"}
                size="small"
                variant="outlined"
              />
            )}
            {/* An item that has followed the team through several retros is worth
                surfacing here more than anywhere — this is the page where someone
                can actually do something about it. */}
            {item._count.carryOvers > 0 && (
              <Chip
                label={
                  item._count.carryOvers === 1
                    ? "carried over once"
                    : `carried over ${item._count.carryOvers} times`
                }
                color={item._count.carryOvers > 2 ? "warning" : "default"}
                size="small"
                variant="outlined"
              />
            )}
          </Stack>
        </Box>
        <MyActionStatus
          retrospectiveId={item.retrospective.id}
          actionItemId={item.id}
          status={item.status}
          description={item.description}
        />
      </Stack>
    </Card>
  );
}
