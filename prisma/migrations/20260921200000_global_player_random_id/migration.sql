-- GlobalPlayer.id becomes an application-assigned random 6-digit number instead of an
-- autoincrementing sequence, so it never reads as a giveaway registration count — assigned
-- in code via src/lib/global-player-id.ts.

ALTER TABLE "GlobalPlayer" ALTER COLUMN "id" DROP DEFAULT;
DROP SEQUENCE IF EXISTS "GlobalPlayer_id_seq";
