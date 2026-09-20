import { effectiveVoteCount } from "@/lib/retroVotes";
import { ACTION_STATUS_LABELS } from "@/lib/actionItems";
import { TEMPLATE_LABELS } from "@/lib/retroTemplates";
import type { BoardView } from "@/server/queries/retro-board-view";

/**
 * Turning a finished board into something you can paste somewhere else.
 *
 * Pure functions over the *already redacted* BoardView, never over raw rows.
 * That is the whole safety story: an export cannot leak what the board itself
 * would not show, because it is handed the same projection the browser gets —
 * `authorName` is already null on an anonymous board, and no id ever reaches
 * it. A separate query "just for the export" is exactly how a redaction rule
 * ends up with two implementations and one of them wrong.
 */

const ANONYMOUS = "Anonymous";

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

/** Stops a card's text from breaking out of the list item it sits in. */
function inlineMarkdown(text: string): string {
  return text.replace(/\r?\n/g, " ").trim();
}

export function toMarkdown(board: BoardView): string {
  const lines: string[] = [];

  lines.push(`# ${board.title}`, "");
  lines.push(
    `**${board.project.company.name} › ${board.project.name}** · ` +
      `${formatDate(board.createdAt)} · facilitated by ${board.facilitatorName}`,
  );
  lines.push("");
  lines.push(`*${TEMPLATE_LABELS[board.template]}*${board.isAnonymous ? " · anonymous board" : ""}`);
  lines.push("");

  for (const column of board.columns) {
    lines.push(`## ${column.title}`, "");

    const topLevel = column.cards
      .filter((card) => !card.groupId)
      .sort((a, b) => effectiveVoteCount(b) - effectiveVoteCount(a));

    if (topLevel.length === 0) {
      lines.push("_Nothing in this column._", "");
      continue;
    }

    for (const card of topLevel) {
      // A concealed tally is null, not zero — so it is omitted rather than
      // exported as "0 votes", which would be a statement the board never made.
      const votes = effectiveVoteCount(card);
      const suffix = card.voteCount === null ? "" : votes > 0 ? ` — ${votes} vote${votes === 1 ? "" : "s"}` : "";
      lines.push(`- ${inlineMarkdown(card.content)}${suffix}`);
      lines.push(`  - *${card.authorName ?? ANONYMOUS}*`);

      for (const child of card.grouped) {
        lines.push(`  - ${inlineMarkdown(child.content)} — *${child.authorName ?? ANONYMOUS}*`);
      }
      for (const comment of card.comments) {
        lines.push(`  - 💬 ${inlineMarkdown(comment.content)} — *${comment.authorName ?? ANONYMOUS}*`);
      }
    }
    lines.push("");
  }

  lines.push("## Action items", "");
  if (board.actionItems.length === 0) {
    lines.push("_None agreed._", "");
  } else {
    for (const item of board.actionItems) {
      const parts = [ACTION_STATUS_LABELS[item.status]];
      if (item.assignees.length > 0) parts.push(item.assignees.map((a) => a.name).join(", "));
      if (item.dueDate) parts.push(`due ${formatDate(item.dueDate)}`);
      if (item.carriedCount > 0) {
        parts.push(item.carriedCount === 1 ? "carried over once" : `carried over ×${item.carriedCount}`);
      }
      lines.push(`- **${inlineMarkdown(item.description)}** — ${parts.join(" · ")}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Escapes one CSV field.
 *
 * The leading apostrophe on `=`, `+`, `-` and `@` is not pedantry: a
 * spreadsheet treats a cell starting with any of them as a formula, so a card
 * reading `=HYPERLINK(...)` becomes live content in whoever opens the file.
 * The retro board accepts arbitrary text from any member, which makes this an
 * injection sink like any other.
 */
export function csvField(value: string | null | undefined): string {
  const text = value ?? "";
  const guarded = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${guarded.replace(/"/g, '""')}"`;
}

const ACTION_CSV_HEADERS = [
  "Retrospective",
  "Project",
  "Company",
  "Action item",
  "Status",
  "Assignees",
  "Due date",
  "Carried over",
  "From card",
] as const;

/**
 * Action items as CSV.
 *
 * Only the action items, deliberately — a board's cards are a conversation and
 * read terribly as rows, whereas the actions are the part someone genuinely
 * wants in a tracker. ISO dates, because a spreadsheet will re-interpret
 * anything else according to whatever locale it was opened in.
 */
export function toActionItemCsv(board: BoardView): string {
  const rows = [ACTION_CSV_HEADERS.map(csvField).join(",")];

  for (const item of board.actionItems) {
    rows.push(
      [
        csvField(board.title),
        csvField(board.project.name),
        csvField(board.project.company.name),
        csvField(item.description),
        csvField(ACTION_STATUS_LABELS[item.status]),
        csvField(item.assignees.map((a) => a.name).join("; ")),
        csvField(item.dueDate ? item.dueDate.toISOString().slice(0, 10) : ""),
        csvField(item.carriedCount > 0 ? String(item.carriedCount) : ""),
        csvField(item.sourceCard?.content ?? ""),
      ].join(","),
    );
  }

  // Trailing newline: POSIX tools treat a file without one as truncated.
  return `${rows.join("\r\n")}\r\n`;
}

/** A filename that survives Windows, macOS and Content-Disposition alike. */
export function exportFilename(board: BoardView, extension: string): string {
  const slug = board.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  const date = board.createdAt.toISOString().slice(0, 10);
  return `${slug || "retrospective"}-${date}.${extension}`;
}
