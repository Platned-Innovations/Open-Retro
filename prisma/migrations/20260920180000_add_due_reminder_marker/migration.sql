-- Due-date reminders.
--
-- Additive and null for every existing row, which means the first scheduler
-- run after deploy would nudge every already-overdue action item at once. That
-- is the correct behaviour rather than a bug: those are exactly the items the
-- tool has been silently sitting on since dueDate was added with nothing
-- acting on it. It happens once — the marker makes sure of that.
ALTER TABLE "ActionItem" ADD COLUMN "dueReminderSentAt" TIMESTAMP(3);

-- The scheduler's own query: "not reminded yet, due by now". A partial index
-- would be tighter, but it cannot be expressed in schema.prisma, and an index
-- the schema doesn't know about is drift waiting to be "fixed" by whoever next
-- runs migrate dev.
CREATE INDEX "ActionItem_dueReminderSentAt_dueDate_idx"
  ON "ActionItem"("dueReminderSentAt", "dueDate");
