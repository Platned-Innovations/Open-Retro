import { NextResponse } from "next/server";
import { getRetroBoard } from "@/server/queries/retros";
import { ForbiddenError, NotFoundError, UnauthorizedError } from "@/lib/authz";
import { exportFilename, toActionItemCsv, toMarkdown } from "@/lib/export/retroExport";

/**
 * Downloads a finished board.
 *
 * A route handler rather than a Server Action because the result is a *file*:
 * actions return values to the React runtime, and getting bytes out of one
 * means round-tripping a base64 string through the client to rebuild a Blob.
 * A GET with Content-Disposition is what browsers already know how to do, and
 * it makes the export a plain link — shareable, bookmarkable, and usable from
 * `curl` when somebody wants to automate it.
 *
 * Authorization is `getRetroBoard`'s, unchanged and unduplicated: it throws
 * before returning anything, and what it does return is already redacted for
 * this viewer. An anonymous board exports as anonymous because the export
 * never sees a name to leak.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ retroId: string }> },
) {
  const { retroId } = await params;
  const format = new URL(request.url).searchParams.get("format") ?? "md";

  if (format !== "md" && format !== "csv") {
    return NextResponse.json(
      { error: "Unsupported format. Use ?format=md or ?format=csv." },
      { status: 400 },
    );
  }

  let board;
  try {
    board = await getRetroBoard(retroId);
  } catch (error) {
    // Mapped here rather than rethrown: an uncaught throw in a route handler is
    // a 500, which tells the caller nothing and logs as though the app broke.
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Sign in to export this retrospective." }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: "Retrospective not found." }, { status: 404 });
    }
    throw error;
  }

  const isCsv = format === "csv";
  const body = isCsv ? toActionItemCsv(board) : toMarkdown(board);

  return new NextResponse(body, {
    headers: {
      "Content-Type": isCsv ? "text/csv; charset=utf-8" : "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${exportFilename(board, isCsv ? "csv" : "md")}"`,
      // A board changes; a cached export would quietly hand someone last
      // week's actions.
      "Cache-Control": "no-store",
    },
  });
}
