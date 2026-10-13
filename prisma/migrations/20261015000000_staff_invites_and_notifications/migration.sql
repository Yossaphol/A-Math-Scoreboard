-- Staff invites (accept/decline) and stored in-app notifications. Enum values and new
-- columns only; existing ACTIVE/REVOKED assignments are unaffected.

-- CreateEnum
CREATE TYPE "NotificationKind" AS ENUM ('STAFF_INVITE', 'STAFF_INVITE_ANSWERED', 'LINK_APPROVED', 'LINK_REJECTED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "StaffStatus" ADD VALUE 'INVITED';
ALTER TYPE "StaffStatus" ADD VALUE 'DECLINED';

-- AlterTable
ALTER TABLE "TournamentStaff" ADD COLUMN     "invitedById" TEXT,
ADD COLUMN     "respondedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "UserNotification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "NotificationKind" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "href" TEXT,
    "staffAssignmentId" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserNotification_userId_createdAt_idx" ON "UserNotification"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "TournamentStaff" ADD CONSTRAINT "TournamentStaff_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserNotification" ADD CONSTRAINT "UserNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserNotification" ADD CONSTRAINT "UserNotification_staffAssignmentId_fkey" FOREIGN KEY ("staffAssignmentId") REFERENCES "TournamentStaff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

