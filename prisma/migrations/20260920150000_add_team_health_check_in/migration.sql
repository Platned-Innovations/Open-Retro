-- Team health check-in.
--
-- Two things worth reading before running this:
--
-- 1. `healthSalt` is NOT NULL with no database default, because Prisma's
--    @default(cuid()) is generated in the client, not by Postgres. Existing
--    rows therefore need a backfill between ADD COLUMN and SET NOT NULL, and
--    each row needs its OWN value — a shared salt would let the same person be
--    correlated across every retrospective in the system, which is the one
--    thing this design exists to prevent. `random()` is evaluated per row.
--
-- 2. `checkInEnabled` flips to true for retrospectives created from now on.
--    Rows that already exist are left alone: a team part-way through a board
--    should not find a new step in front of them.

-- --------------------------------------------------------------------------
-- Enum
-- --------------------------------------------------------------------------
CREATE TYPE "HealthDimension" AS ENUM (
  'MORALE', 'DELIVERY', 'COLLABORATION', 'CLARITY', 'WORKLOAD'
);

-- --------------------------------------------------------------------------
-- Retrospective: the per-retro salt, and the new default
-- --------------------------------------------------------------------------
ALTER TABLE "Retrospective" ADD COLUMN "healthSalt" TEXT;

UPDATE "Retrospective"
   SET "healthSalt" = md5(random()::text || clock_timestamp()::text || "id")
 WHERE "healthSalt" IS NULL;

ALTER TABLE "Retrospective" ALTER COLUMN "healthSalt" SET NOT NULL;

-- New retros get a check-in; existing ones keep whatever they have.
ALTER TABLE "Retrospective" ALTER COLUMN "checkInEnabled" SET DEFAULT true;

-- --------------------------------------------------------------------------
-- HealthCheckIn: one row per participant per retro, keyed by HMAC, not userId
-- --------------------------------------------------------------------------
CREATE TABLE "HealthCheckIn" (
  "id"              TEXT NOT NULL,
  "retrospectiveId" TEXT NOT NULL,
  "participantKey"  TEXT NOT NULL,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL,

  CONSTRAINT "HealthCheckIn_pkey" PRIMARY KEY ("id")
);

-- The unique is what makes re-submitting an amendment rather than a second
-- voice in the average.
CREATE UNIQUE INDEX "HealthCheckIn_retrospectiveId_participantKey_key"
  ON "HealthCheckIn"("retrospectiveId", "participantKey");

ALTER TABLE "HealthCheckIn"
  ADD CONSTRAINT "HealthCheckIn_retrospectiveId_fkey"
  FOREIGN KEY ("retrospectiveId") REFERENCES "Retrospective"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- --------------------------------------------------------------------------
-- HealthScore
-- --------------------------------------------------------------------------
CREATE TABLE "HealthScore" (
  "id"              TEXT NOT NULL,
  "checkInId"       TEXT NOT NULL,
  "retrospectiveId" TEXT NOT NULL,
  "dimension"       "HealthDimension" NOT NULL,
  "value"           INTEGER NOT NULL,

  CONSTRAINT "HealthScore_pkey" PRIMARY KEY ("id")
);

-- The scale, enforced where it cannot be bypassed. A 7 on a 1-5 scale would
-- not error anywhere — it would just quietly lift every average that reads it.
ALTER TABLE "HealthScore"
  ADD CONSTRAINT "HealthScore_value_check" CHECK ("value" BETWEEN 1 AND 5);

CREATE UNIQUE INDEX "HealthScore_checkInId_dimension_key"
  ON "HealthScore"("checkInId", "dimension");
CREATE INDEX "HealthScore_retrospectiveId_dimension_idx"
  ON "HealthScore"("retrospectiveId", "dimension");

ALTER TABLE "HealthScore"
  ADD CONSTRAINT "HealthScore_checkInId_fkey"
  FOREIGN KEY ("checkInId") REFERENCES "HealthCheckIn"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "HealthScore"
  ADD CONSTRAINT "HealthScore_retrospectiveId_fkey"
  FOREIGN KEY ("retrospectiveId") REFERENCES "Retrospective"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
