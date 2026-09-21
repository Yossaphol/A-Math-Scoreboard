-- Max Diff Cap is removed: it duplicated Maximum Score's job of bounding Game Difference,
-- so the tournament only keeps one diff-limiting setting per Round.

ALTER TABLE "Round" DROP COLUMN "maxDiffCapEnabled";
ALTER TABLE "Round" DROP COLUMN "maxDiffCap";
