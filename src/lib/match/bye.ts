import type { MatchOutcome } from "@/generated/prisma/enums";

// Spec §19: a Bye is a W worth a 100-0 game (Diff +100). The same 100 applies to both kinds:
// - the odd-player-count Bye (Match.isBye, no opponent at all), and
// - the late-arrival Bye (Match.forfeitPlayerId): the present player gets W 100-0 (+100)
//   and the player who didn't show gets L 0-100 (-100).
// Neither is capped by Maximum Score — no game was actually played.
export const BYE_SCORE = 100;

/** Final-result fields for a late-arrival Bye where `absentPlayerId` didn't show up. */
export function forfeitResult(
  match: { player1Id: string; player2Id: string | null },
  absentPlayerId: string
): {
  finalPlayer1Score: number;
  finalPlayer2Score: number;
  player1Result: MatchOutcome;
  player2Result: MatchOutcome;
} {
  const player1Absent = absentPlayerId === match.player1Id;
  return {
    finalPlayer1Score: player1Absent ? 0 : BYE_SCORE,
    finalPlayer2Score: player1Absent ? BYE_SCORE : 0,
    player1Result: player1Absent ? "LOSS" : "WIN",
    player2Result: player1Absent ? "WIN" : "LOSS",
  };
}
