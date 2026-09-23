export type Winner = "PLAYER1" | "PLAYER2" | "TIE";

/**
 * Shared by ResultForm (confirming an existing match) and NewSelfServiceMatchForm (starting a
 * brand-new ad-hoc one) so the winner/score validation rule can never drift between the two
 * — even though their surrounding JSX (labels, hidden fields) differs enough that forcing
 * them into one shared component isn't worth it.
 */
export function validateWinnerScores(
  winner: Winner | null,
  winnerScore: string,
  loserScore: string,
  tieScore: string
): string | null {
  if (!winner) return "กรุณาเลือกผู้ชนะ";
  if (winner === "TIE") {
    return tieScore === "" ? "กรุณากรอกคะแนน" : null;
  }
  if (winnerScore === "" || loserScore === "") return "กรุณากรอกคะแนนให้ครบ";
  if (Number(winnerScore) <= Number(loserScore)) return "คะแนนผู้ชนะต้องมากกว่าคะแนนผู้แพ้";
  return null;
}
