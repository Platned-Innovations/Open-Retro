import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { getRetroBoard } from "@/server/queries/retros";
import { csvField, exportFilename, toActionItemCsv, toMarkdown } from "@/lib/export/retroExport";
import { asUser, seedCard, seedFixture, seedVote, type Fixture } from "./factory";

let f: Fixture;
beforeEach(async () => {
  f = await seedFixture();
});

describe("csv escaping", () => {
  it("quotes and doubles embedded quotes", () => {
    expect(csvField('say "hello"')).toBe('"say ""hello"""');
  });

  it("keeps commas and newlines inside one field", () => {
    expect(csvField("a,b\nc")).toBe('"a,b\nc"');
  });

  /**
   * A spreadsheet treats a cell starting with =, +, - or @ as a formula. The
   * board accepts arbitrary text from any member, so this is an injection sink
   * like any other — the export is just the delivery mechanism.
   */
  it.each(["=SUM(A1)", "+1+1", "-2+3", "@import"])("neutralises the formula %s", (payload) => {
    // The apostrophe is what makes the cell literal text; the payload itself
    // is kept intact so the export is still a faithful record of what was said.
    expect(csvField(payload)).toBe(`"'${payload}"`);
  });

  it("guards a formula that also contains quotes", () => {
    expect(csvField('=HYPERLINK("http://evil")')).toBe('"\'=HYPERLINK(""http://evil"")"');
  });

  it("leaves ordinary text alone", () => {
    expect(csvField("Ship the thing")).toBe('"Ship the thing"');
  });
});

describe("markdown", () => {
  it("includes the board, its cards and its action items", async () => {
    await seedCard(f.retroA, { authorId: f.users.projA1Member.id, content: "the build is slow" });
    await prisma.actionItem.create({
      data: {
        retrospectiveId: f.retroA.id,
        description: "speed up CI",
        createdById: f.users.projA1Admin.id,
        assignees: { create: [{ userId: f.users.projA1Member.id }] },
      },
    });

    asUser(f.users.projA1Member);
    const markdown = toMarkdown(await getRetroBoard(f.retroA.id));

    expect(markdown).toContain("# Retro A");
    expect(markdown).toContain("the build is slow");
    expect(markdown).toContain("speed up CI");
    expect(markdown).toContain("projA1Member");
  });

  /**
   * The export reads the same redacted projection the browser gets, so this
   * holds without the exporter knowing anything about anonymity.
   */
  it("names nobody on an anonymous board", async () => {
    await seedCard(f.anonRetroA, {
      authorId: f.users.projA1Other.id,
      content: "something candid",
    });

    asUser(f.users.projA1Member);
    const markdown = toMarkdown(await getRetroBoard(f.anonRetroA.id));

    expect(markdown).toContain("something candid");
    expect(markdown).toContain("Anonymous");
    expect(markdown).not.toContain("projA1Other");
  });

  it("still marks your own card as yours on an anonymous board", async () => {
    await seedCard(f.anonRetroA, { authorId: f.users.projA1Member.id, content: "mine" });

    asUser(f.users.projA1Member);
    const markdown = toMarkdown(await getRetroBoard(f.anonRetroA.id));
    expect(markdown).toContain("projA1Member");
  });

  it("orders cards by their effective vote count", async () => {
    const quiet = await seedCard(f.retroA, {
      authorId: f.users.projA1Member.id,
      content: "quiet card",
    });
    const popular = await seedCard(f.retroA, {
      authorId: f.users.projA1Member.id,
      content: "popular card",
      order: 1,
    });
    await seedVote(f.retroA, popular.id, f.users.projA1Member.id);
    await seedVote(f.retroA, popular.id, f.users.projA1Other.id);
    await seedVote(f.retroA, quiet.id, f.users.projA1Member.id);

    asUser(f.users.projA1Member);
    const markdown = toMarkdown(await getRetroBoard(f.retroA.id));

    expect(markdown.indexOf("popular card")).toBeLessThan(markdown.indexOf("quiet card"));
  });

  /** Null means concealed, not zero — exporting "0 votes" would invent a fact. */
  it("omits the tally entirely when it is concealed", async () => {
    const guarded = await prisma.retrospective.update({
      where: { id: f.retroA.id },
      data: { isGuided: true, phase: "VOTE", hideVoteCounts: true },
      include: { columns: { orderBy: { order: "asc" } } },
    });
    await seedCard(guarded, { authorId: f.users.projA1Member.id, content: "unscored" });

    asUser(f.users.projA1Member);
    const markdown = toMarkdown(await getRetroBoard(f.retroA.id));

    expect(markdown).toContain("unscored");
    expect(markdown).not.toContain("0 vote");
  });
});

describe("action item csv", () => {
  it("writes a header plus one row per action item", async () => {
    await prisma.actionItem.create({
      data: {
        retrospectiveId: f.retroA.id,
        description: "write, with a comma",
        createdById: f.users.projA1Admin.id,
        dueDate: new Date("2026-10-01T00:00:00.000Z"),
        assignees: { create: [{ userId: f.users.projA1Member.id }] },
      },
    });

    asUser(f.users.projA1Member);
    const csv = toActionItemCsv(await getRetroBoard(f.retroA.id));
    const lines = csv.trimEnd().split("\r\n");

    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain('"Action item"');
    expect(lines[1]).toContain('"write, with a comma"');
    // ISO, so a spreadsheet can't re-read it as some other locale's date.
    expect(lines[1]).toContain('"2026-10-01"');
  });

  it("returns just the header when there is nothing to export", async () => {
    asUser(f.users.projA1Member);
    const csv = toActionItemCsv(await getRetroBoard(f.retroA.id));
    expect(csv.trimEnd().split("\r\n")).toHaveLength(1);
  });

  it("carries no identity beyond the assignee names it deliberately shows", async () => {
    await prisma.actionItem.create({
      data: {
        retrospectiveId: f.anonRetroA.id,
        description: "an action",
        createdById: f.users.projA1Admin.id,
      },
    });

    asUser(f.users.projA1Member);
    const csv = toActionItemCsv(await getRetroBoard(f.anonRetroA.id));
    expect(csv).not.toContain(f.users.projA1Admin.id);
    expect(csv).not.toContain("@example.test");
  });
});

describe("filename", () => {
  it("slugs the title and dates it", async () => {
    asUser(f.users.projA1Member);
    const board = await getRetroBoard(f.retroA.id);
    expect(exportFilename(board, "md")).toMatch(/^retro-a-\d{4}-\d{2}-\d{2}\.md$/);
  });

  it("falls back rather than producing a nameless file", async () => {
    await prisma.retrospective.update({ where: { id: f.retroA.id }, data: { title: "!!!" } });
    asUser(f.users.projA1Member);
    const board = await getRetroBoard(f.retroA.id);
    expect(exportFilename(board, "csv")).toMatch(/^retrospective-\d{4}-\d{2}-\d{2}\.csv$/);
  });
});
