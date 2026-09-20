-- Action-item follow-through: a real status, a link back to the card that
-- raised it, and carry-over between retrospectives.
--
-- `done` is backfilled into `status` and then dropped outright rather than
-- dual-written. This is a single-process deployment shipping one release, and
-- a lingering boolean alongside the enum is precisely how two sources of truth
-- drift apart.

CREATE TYPE "ActionItemStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'DROPPED');

ALTER TABLE "ActionItem"
  ADD COLUMN "status"       "ActionItemStatus" NOT NULL DEFAULT 'OPEN',
  ADD COLUMN "completedAt"  TIMESTAMP(3),
  ADD COLUMN "sourceCardId" TEXT;

-- updatedAt is the closest thing to a completion time the old shape recorded.
-- It is an approximation, and a better one than leaving the date empty for
-- every item that was already finished.
UPDATE "ActionItem"
   SET "status" = 'DONE', "completedAt" = "updatedAt"
 WHERE "done" = true;

ALTER TABLE "ActionItem" DROP COLUMN "done";

DROP INDEX IF EXISTS "ActionItem_retrospectiveId_idx";
CREATE INDEX "ActionItem_retrospectiveId_status_idx" ON "ActionItem"("retrospectiveId", "status");
CREATE INDEX "ActionItem_status_dueDate_idx"         ON "ActionItem"("status", "dueDate");
CREATE INDEX "ActionItem_sourceCardId_idx"           ON "ActionItem"("sourceCardId");

ALTER TABLE "ActionItem" ADD CONSTRAINT "ActionItem_sourceCardId_fkey"
  FOREIGN KEY ("sourceCardId") REFERENCES "RetroCard"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- --------------------------------------------------------------------------
-- Carry-over: a reference to an item raised elsewhere, never a copy of it.
-- --------------------------------------------------------------------------
CREATE TABLE "RetroCarryOver" (
  "id"              TEXT NOT NULL,
  "retrospectiveId" TEXT NOT NULL,
  "actionItemId"    TEXT NOT NULL,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt"      TIMESTAMP(3),
  CONSTRAINT "RetroCarryOver_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RetroCarryOver_retrospectiveId_actionItemId_key"
  ON "RetroCarryOver"("retrospectiveId", "actionItemId");
CREATE INDEX "RetroCarryOver_actionItemId_idx" ON "RetroCarryOver"("actionItemId");

ALTER TABLE "RetroCarryOver" ADD CONSTRAINT "RetroCarryOver_retrospectiveId_fkey"
  FOREIGN KEY ("retrospectiveId") REFERENCES "Retrospective"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RetroCarryOver" ADD CONSTRAINT "RetroCarryOver_actionItemId_fkey"
  FOREIGN KEY ("actionItemId") REFERENCES "ActionItem"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
