-- DropForeignKey
ALTER TABLE "ActionItem" DROP CONSTRAINT "ActionItem_assigneeId_fkey";

-- AlterTable
ALTER TABLE "ActionItem" DROP COLUMN "assigneeId";

