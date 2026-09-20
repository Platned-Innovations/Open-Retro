-- Drops the Auth.js adapter tables, which were never used.
--
-- The schema comment claimed "the PrismaAdapter still needs these models
-- present for type/adapter compatibility". No adapter is configured — auth.ts
-- runs two Credentials providers on the JWT session strategy, and
-- @auth/prisma-adapter is imported nowhere. Sign-in has always gone through
-- our own LoginToken, which stays.
--
-- All three were verified empty on the live database before this ran, which is
-- the only reason a DROP is acceptable here. If an OAuth provider is ever
-- added, the adapter's tables come back as a new migration — that is cheaper
-- than carrying three tables nobody writes to and a comment that isn't true.
DROP TABLE IF EXISTS "Account";
DROP TABLE IF EXISTS "Session";
DROP TABLE IF EXISTS "VerificationToken";
