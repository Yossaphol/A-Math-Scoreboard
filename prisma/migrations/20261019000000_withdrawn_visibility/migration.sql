-- Show/hide Withdrawn players (/admin/settings). Additive only — adds two columns with
-- defaults to the one-row SystemSetting table; no other table is touched.

-- AlterTable
ALTER TABLE "SystemSetting" ADD COLUMN     "showWithdrawnAdmin" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "showWithdrawnPublic" BOOLEAN NOT NULL DEFAULT false;
