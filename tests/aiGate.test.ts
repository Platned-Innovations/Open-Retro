import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { ForbiddenError, NotFoundError, requireCompanyAiEnabled } from "@/lib/authz";
import { setCompanyAiFeatures } from "@/server/org/companies";
import { asUser, seedFixture, type Fixture } from "./factory";

let f: Fixture;
beforeEach(async () => {
  f = await seedFixture();
});

describe("the gate", () => {
  it("is off for a company nobody has switched it on for", async () => {
    await expect(requireCompanyAiEnabled(f.companyA.id)).rejects.toThrow(ForbiddenError);
  });

  it("opens once a company admin turns it on", async () => {
    asUser(f.users.coAAdmin);
    await setCompanyAiFeatures({ companyId: f.companyA.id, enabled: true });

    await expect(requireCompanyAiEnabled(f.companyA.id)).resolves.toBeUndefined();
  });

  /**
   * The flag is per company, so one company opting in must not speak for
   * another — this is the assertion that a shared install stays separated.
   */
  it("does not open for a different company", async () => {
    asUser(f.users.coAAdmin);
    await setCompanyAiFeatures({ companyId: f.companyA.id, enabled: true });

    await expect(requireCompanyAiEnabled(f.companyB.id)).rejects.toThrow(ForbiddenError);
  });

  it("closes again when it is switched off", async () => {
    asUser(f.users.coAAdmin);
    await setCompanyAiFeatures({ companyId: f.companyA.id, enabled: true });
    await setCompanyAiFeatures({ companyId: f.companyA.id, enabled: false });

    await expect(requireCompanyAiEnabled(f.companyA.id)).rejects.toThrow(ForbiddenError);
  });

  it("refuses an unknown company rather than defaulting open", async () => {
    await expect(requireCompanyAiEnabled("does-not-exist")).rejects.toThrow(NotFoundError);
  });
});

describe("who may change it", () => {
  it("refuses a plain member of the company", async () => {
    asUser(f.users.projA1Member);
    await expect(
      setCompanyAiFeatures({ companyId: f.companyA.id, enabled: true }),
    ).rejects.toThrow(ForbiddenError);

    const company = await prisma.company.findUniqueOrThrow({ where: { id: f.companyA.id } });
    expect(company.aiFeaturesEnabled).toBe(false);
  });

  it("refuses an admin of another company", async () => {
    asUser(f.users.outsiderB);
    await expect(
      setCompanyAiFeatures({ companyId: f.companyA.id, enabled: true }),
    ).rejects.toThrow(ForbiddenError);
  });

  /**
   * A platform admin can administer the install, as everywhere else. What
   * they cannot do is bypass the resulting flag — that is the assertion in
   * "the gate" above, and it is the one that matters.
   */
  it("allows a super admin, who administers every company", async () => {
    asUser(f.users.superAdmin);
    await expect(
      setCompanyAiFeatures({ companyId: f.companyA.id, enabled: true }),
    ).resolves.toBeUndefined();
  });
});
