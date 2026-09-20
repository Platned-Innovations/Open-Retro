import { beforeEach, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { assertIsDisposableTestDatabase } from "./testDatabaseUrl";

// Checked again here, not just in globalSetup: setup files run inside the test
// worker, which is the process that actually issues the TRUNCATE.
assertIsDisposableTestDatabase(process.env.DATABASE_URL);

// The three seams between the code under test and the outside world.
//
// `auth` is the only thing authz.ts needs from NextAuth, and reading a real
// session would require a request scope we don't have. `revalidatePath` throws
// outside one. `sendMail` would send actual mail via Microsoft Graph — several
// tests assert it was NOT called, which only means anything if it's mocked.
//
// `broadcastToRetro` needs no mock: getIO() returns undefined outside
// server.ts and src/lib/socket/emit.ts already no-ops in that case.
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
// Resolves rather than returning undefined: callers do `sendMail(...).catch(...)`,
// so a bare vi.fn() would throw before the code under test could be judged.
vi.mock("@/lib/email/graphMailer", () => ({ sendMail: vi.fn(async () => {}) }));

beforeEach(async () => {
  // Company and User are the two roots; every other table hangs off one of
  // them by a cascading foreign key, so CASCADE clears the whole schema.
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "Company", "User" RESTART IDENTITY CASCADE');
  vi.clearAllMocks();
});
