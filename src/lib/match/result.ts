import type { MatchOutcome } from "@/generated/prisma/enums";

// W/T/L is decided from the raw recorded scores — Maximum Score only caps the Diff used
// for pairing/ranking (spec §8), it never changes who actually won a game.
export function computeResult(
  player1Score: number,
  player2Score: number
): { player1Result: MatchOutcome; player2Result: MatchOutcome } {
  if (player1Score === player2Score) {
    return { player1Result: "TIE", player2Result: "TIE" };
  }
  return player1Score > player2Score
    ? { player1Result: "WIN", player2Result: "LOSS" }
    : { player1Result: "LOSS", player2Result: "WIN" };
}
