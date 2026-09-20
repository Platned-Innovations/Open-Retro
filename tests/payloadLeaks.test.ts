import { beforeEach, describe, expect, it } from "vitest";
import { getRetroBoard } from "@/server/queries/retros";
import { getProject } from "@/server/queries/projects";
import { getCompany } from "@/server/queries/companies";
import { listAddableCompanyMembers } from "@/server/queries/invitations";
import { asUser, seedFixture, type Fixture } from "./factory";

let f: Fixture;
beforeEach(async () => {
  f = await seedFixture();
});

/**
 * These four reads are all passed straight into `"use client"` components, so
 * whatever they return is serialized into the RSC Flight payload the browser
 * receives. `include: { user: true }` selects *every* User scalar — which meant
 * every member's email, and the Super Admin's bcrypt password hash, were
 * readable from the page source of any board they belonged to.
 *
 * Asserting on the serialized string rather than on named fields is the point:
 * it covers relations nobody thought to list, including ones added later.
 */
function serialize(value: unknown): string {
  return JSON.stringify(value);
}

const BCRYPT_PREFIX = "$2b$";

describe("no read leaks credentials into a client payload", () => {
  it("getRetroBoard", async () => {
    asUser(f.users.projA1Member);
    const payload = serialize(await getRetroBoard(f.retroA.id));

    expect(payload).not.toContain(BCRYPT_PREFIX);
    expect(payload).not.toContain("passwordHash");
    expect(payload).not.toContain("@example.test");
  });

  it("getProject", async () => {
    asUser(f.users.projA1Member);
    const payload = serialize(await getProject(f.projectA1.id));

    expect(payload).not.toContain(BCRYPT_PREFIX);
    expect(payload).not.toContain("passwordHash");
  });

  it("getCompany", async () => {
    asUser(f.users.projA1Member);
    const payload = serialize(await getCompany(f.companyA.id));

    expect(payload).not.toContain(BCRYPT_PREFIX);
    expect(payload).not.toContain("passwordHash");
  });

  it("listAddableCompanyMembers", async () => {
    asUser(f.users.projA1Admin);
    const payload = serialize(await listAddableCompanyMembers(f.projectA1.id));

    expect(payload).not.toContain(BCRYPT_PREFIX);
    expect(payload).not.toContain("passwordHash");
  });
});

/**
 * The member-management surfaces are the two places a human genuinely needs an
 * email to tell two people apart, so narrowing the selects must not take those
 * away. Asserted explicitly so a future over-narrowing is caught as a failure
 * rather than a silently blank column.
 */
describe("member-management reads keep the fields their UI renders", () => {
  it("getProject still exposes member names and emails", async () => {
    asUser(f.users.projA1Member);
    const project = await getProject(f.projectA1.id);
    const member = project.memberships.find((m) => m.userId === f.users.projA1Other.id);

    expect(member?.user.name).toBe("projA1Other");
    expect(member?.user.email).toBe("projA1Other@example.test");
  });

  it("listAddableCompanyMembers still exposes names and emails", async () => {
    asUser(f.users.projA1Admin);
    const addable = await listAddableCompanyMembers(f.projectA1.id);

    expect(addable.map((u) => u.name)).toContain("projA2Member");
    expect(addable.every((u) => typeof u.email === "string")).toBe(true);
  });
});
