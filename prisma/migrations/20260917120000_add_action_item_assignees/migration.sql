-- CreateTable
CREATE TABLE "ActionItemAssignee" (
    "id" TEXT NOT NULL,
    "actionItemId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActionItemAssignee_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ActionItemAssignee_userId_idx" ON "ActionItemAssignee"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ActionItemAssignee_actionItemId_userId_key" ON "ActionItemAssignee"("actionItemId", "userId");

-- AddForeignKey
ALTER TABLE "ActionItemAssignee" ADD CONSTRAINT "ActionItemAssignee_actionItemId_fkey" FOREIGN KEY ("actionItemId") REFERENCES "ActionItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionItemAssignee" ADD CONSTRAINT "ActionItemAssignee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

