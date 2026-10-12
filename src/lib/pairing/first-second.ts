import "server-only";
import { prisma } from "@/lib/prisma";

// Spec §11 — the "เริ่มก่อนหลัง" score. Every player has ONE running number for the whole
// Tournament, starting at 0:
//   - started first in a game  → +2
//   - started second in a game → +1
// When pairing the next game, the player with the LOWER score starts first; equal scores are
// decided at random. e.g. A vs B, A starts first → A = 2, B = 1. They meet again: B is lower,
// so B starts first → B = 3, A = 3. Next time they're equal → random.
export const FIRST_POINTS = 2;
export const SECOND_POINTS = 1;

/**
 * Every player's current "เริ่มก่อนหลัง" score, built by replaying the CONFIRMED games in
 * order and adding to that one number. Derived on demand rather than stored, so an edited
 * result, a deleted round or a re-paired match can never leave it out of date.
 */
export async function getFirstSecondScores(tournamentId: string): Promise<Map<string, number>> {
  const games = await prisma.match.findMany({
    where: {
      round: { tournamentId },
      status: "CONFIRMED",
      firstPlayerId: { not: null },
      secondPlayerId: { not: null },
    },
    orderBy: [{ round: { roundNumber: "asc" } }, { createdAt: "asc" }],
    select: { firstPlayerId: true, secondPlayerId: true },
  });

  const score = new Map<string, number>();
  for (const game of games) {
    score.set(game.firstPlayerId!, (score.get(game.firstPlayerId!) ?? 0) + FIRST_POINTS);
    score.set(game.secondPlayerId!, (score.get(game.secondPlayerId!) ?? 0) + SECOND_POINTS);
  }
  return score;
}

/** Who starts first in the next game between these two: lower score first, equal → random. */
export function assignFirstSecond(
  player1Id: string,
  player2Id: string,
  scores: Map<string, number>
): { firstPlayerId: string; secondPlayerId: string } {
  const score1 = scores.get(player1Id) ?? 0;
  const score2 = scores.get(player2Id) ?? 0;

  const player1First = score1 === score2 ? Math.random() < 0.5 : score1 < score2;
  return player1First
    ? { firstPlayerId: player1Id, secondPlayerId: player2Id }
    : { firstPlayerId: player2Id, secondPlayerId: player1Id };
}
