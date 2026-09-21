-- Match.player1Id was ON DELETE RESTRICT (Prisma's default for a required relation), which
-- blocked deleting a Tournament (or any TournamentPlayer) once a single match existed under
-- it. player2Id is already ON DELETE SET NULL since it's optional; player1Id can't use that
-- (it's NOT NULL), so it needs CASCADE instead.

ALTER TABLE "Match" DROP CONSTRAINT "Match_player1Id_fkey";
ALTER TABLE "Match" ADD CONSTRAINT "Match_player1Id_fkey" FOREIGN KEY ("player1Id") REFERENCES "TournamentPlayer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
