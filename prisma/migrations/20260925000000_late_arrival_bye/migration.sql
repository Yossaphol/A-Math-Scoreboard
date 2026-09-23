-- Late-arrival Bye: a paired opponent who never showed up forfeits (present player W 100-0,
-- absent player L 0-100). A player can report it from the table QR page, pending Admin/Staff
-- approval. All columns are nullable, so existing rows are unaffected.
ALTER TABLE "Match" ADD COLUMN "forfeitPlayerId" TEXT;
ALTER TABLE "Match" ADD COLUMN "byeClaimedById" TEXT;
ALTER TABLE "Match" ADD COLUMN "byeClaimedAt" TIMESTAMP(3);
