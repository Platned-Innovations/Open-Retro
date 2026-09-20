/**
 * The shape of a user as the member-management UI sees them.
 *
 * Client components used to import Prisma's generated `User` type directly,
 * which described a row containing `passwordHash` — and typed props that way
 * invite queries that actually fetch it. This is the whole contract: three
 * fields, all of them safe to render.
 */
export type MemberUser = {
  id: string;
  name: string;
  email: string;
};
