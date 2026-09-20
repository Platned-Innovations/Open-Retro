-- Facilitation phase engine.
--
-- Two things here need care:
--
-- 1. Every retrospective that already exists is migrated to isGuided = false,
--    with concealment off. A team part-way through a board must not have the
--    rules change under them, and a retro nobody ever set a phase on should not
--    suddenly claim to be in one.
--
-- 2. RetroCard.retrospectiveId is denormalised from its column, and a composite
--    foreign key makes the database enforce that they agree. That means
--    add-nullable, backfill, SET NOT NULL, then swap the FK — in that order.
--    The SET NOT NULL fails loudly if any orphan rows exist, which is the point;
--    run the pre-flight queries in the roadmap's Verification section first.

-- --------------------------------------------------------------------------
-- Enums
-- --------------------------------------------------------------------------
CREATE TYPE "RetroPhase" AS ENUM (
  'LOBBY', 'CHECK_IN', 'COLLECT', 'GROUP', 'VOTE', 'DISCUSS', 'ACTIONS', 'CLOSED'
);
CREATE TYPE "ColumnSentiment" AS ENUM ('POSITIVE', 'NEGATIVE', 'NEUTRAL');

-- --------------------------------------------------------------------------
-- Retrospective: the flow itself
-- --------------------------------------------------------------------------
ALTER TABLE "Retrospective"
  ADD COLUMN "isGuided"          BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "phase"             "RetroPhase" NOT NULL DEFAULT 'LOBBY',
  ADD COLUMN "phaseStartedAt"    TIMESTAMP(3),
  ADD COLUMN "hideOthersCards"   BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "collectRevealedAt" TIMESTAMP(3),
  ADD COLUMN "voteBudget"        INTEGER NOT NULL DEFAULT 5,
  ADD COLUMN "hideVoteCounts"    BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "discussCardId"     TEXT,
  ADD COLUMN "discussSeconds"    INTEGER NOT NULL DEFAULT 300,
  ADD COLUMN "checkInEnabled"    BOOLEAN NOT NULL DEFAULT false;

-- 0 means unlimited; the upper bound is a sanity rail, not a product rule.
ALTER TABLE "Retrospective"
  ADD CONSTRAINT "Retrospective_voteBudget_check" CHECK ("voteBudget" BETWEEN 0 AND 50);
ALTER TABLE "Retrospective"
  ADD CONSTRAINT "Retrospective_discussSeconds_check" CHECK ("discussSeconds" BETWEEN 30 AND 3600);

-- Existing retros keep exactly the behaviour they have today.
UPDATE "Retrospective" SET
  "isGuided"          = false,
  "hideOthersCards"   = false,
  "hideVoteCounts"    = false,
  "voteBudget"        = 0,
  "collectRevealedAt" = COALESCE("startedAt", "createdAt"),
  "phase"             = CASE
                          WHEN "status" IN ('COMPLETED', 'ARCHIVED') THEN 'CLOSED'::"RetroPhase"
                          ELSE 'COLLECT'::"RetroPhase"
                        END;

CREATE INDEX "Retrospective_projectId_createdAt_idx" ON "Retrospective"("projectId", "createdAt");

-- --------------------------------------------------------------------------
-- RetroColumn: sentiment, and the composite-FK target
-- --------------------------------------------------------------------------
ALTER TABLE "RetroColumn" ADD COLUMN "sentiment" "ColumnSentiment" NOT NULL DEFAULT 'NEUTRAL';

-- Backfilled from the built-in template titles. Custom columns stay NEUTRAL,
-- which is the honest answer: nobody has said what they mean.
UPDATE "RetroColumn" SET "sentiment" = 'POSITIVE'
  WHERE "title" IN ('Glad', 'Liked', 'Learned', 'Went well', '🙌 Keep doing', '▶️ Start doing');
UPDATE "RetroColumn" SET "sentiment" = 'NEGATIVE'
  WHERE "title" IN ('Mad', 'Sad', 'Lacked', 'Longed for', 'To improve', '🛑 Stop doing');

ALTER TABLE "RetroColumn" ADD CONSTRAINT "RetroColumn_id_retrospectiveId_key" UNIQUE ("id", "retrospectiveId");

-- --------------------------------------------------------------------------
-- RetroCard: denormalised retrospectiveId, enforced by a composite FK
-- --------------------------------------------------------------------------
ALTER TABLE "RetroCard"
  ADD COLUMN "retrospectiveId" TEXT,
  ADD COLUMN "discussedAt"     TIMESTAMP(3);

UPDATE "RetroCard" c
   SET "retrospectiveId" = col."retrospectiveId"
  FROM "RetroColumn" col
 WHERE col."id" = c."columnId";

-- Fails if any card has no column. That is a real inconsistency, and this
-- migration is the right place to find out about it.
ALTER TABLE "RetroCard" ALTER COLUMN "retrospectiveId" SET NOT NULL;

ALTER TABLE "RetroCard" DROP CONSTRAINT "RetroCard_columnId_fkey";
ALTER TABLE "RetroCard" ADD CONSTRAINT "RetroCard_columnId_retrospectiveId_fkey"
  FOREIGN KEY ("columnId", "retrospectiveId")
  REFERENCES "RetroColumn"("id", "retrospectiveId")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RetroCard" ADD CONSTRAINT "RetroCard_retrospectiveId_fkey"
  FOREIGN KEY ("retrospectiveId") REFERENCES "Retrospective"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "RetroCard_retrospectiveId_idx" ON "RetroCard"("retrospectiveId");

-- --------------------------------------------------------------------------
-- CardVote: same denormalisation, for the vote-budget count
-- --------------------------------------------------------------------------
ALTER TABLE "CardVote" ADD COLUMN "retrospectiveId" TEXT;

UPDATE "CardVote" v
   SET "retrospectiveId" = c."retrospectiveId"
  FROM "RetroCard" c
 WHERE c."id" = v."cardId";

ALTER TABLE "CardVote" ALTER COLUMN "retrospectiveId" SET NOT NULL;
ALTER TABLE "CardVote" ADD CONSTRAINT "CardVote_retrospectiveId_fkey"
  FOREIGN KEY ("retrospectiveId") REFERENCES "Retrospective"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "CardVote_retrospectiveId_userId_idx" ON "CardVote"("retrospectiveId", "userId");

-- --------------------------------------------------------------------------
-- Last, because it points at RetroCard
-- --------------------------------------------------------------------------
ALTER TABLE "Retrospective" ADD CONSTRAINT "Retrospective_discussCardId_fkey"
  FOREIGN KEY ("discussCardId") REFERENCES "RetroCard"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- --------------------------------------------------------------------------
-- Attendance
-- --------------------------------------------------------------------------
CREATE TABLE "RetroParticipant" (
  "id"              TEXT NOT NULL,
  "retrospectiveId" TEXT NOT NULL,
  "userId"          TEXT NOT NULL,
  "firstSeenAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RetroParticipant_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RetroParticipant_retrospectiveId_userId_key"
  ON "RetroParticipant"("retrospectiveId", "userId");
CREATE INDEX "RetroParticipant_userId_idx" ON "RetroParticipant"("userId");

ALTER TABLE "RetroParticipant" ADD CONSTRAINT "RetroParticipant_retrospectiveId_fkey"
  FOREIGN KEY ("retrospectiveId") REFERENCES "Retrospective"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RetroParticipant" ADD CONSTRAINT "RetroParticipant_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
