-- A User is STAFF only while they have an ACTIVE Staff assignment (see src/lib/staff-role.ts).

-- AlterEnum
ALTER TYPE "NotificationKind" ADD VALUE 'STAFF_REMOVED';


-- Data fix: people revoked (or whose only tournament was deleted) before this rule existed
-- kept the STAFF role and could still open the admin pages. Admins are left alone.
UPDATE "User" SET "role" = 'USER', "updatedAt" = CURRENT_TIMESTAMP
WHERE "role" = 'STAFF'
  AND NOT EXISTS (
    SELECT 1 FROM "TournamentStaff" ts WHERE ts."userId" = "User"."id" AND ts."status" = 'ACTIVE'
  );
