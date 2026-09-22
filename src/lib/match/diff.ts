// Spec §8: Maximum Score caps the GAME'S SPREAD (winning margin), never the raw recorded
// score. e.g. 442 vs 851 with Maximum Score 350 → raw diff -409 clamps to -350/+350 (capping
// each player's score to 350 first would wrongly zero this exact case out: 350-350=0).
// Shared by the Scoreboard, the pairing Standings, and the per-Round summary table so all
// three always agree on the same number.
export function cappedDiff(
  ownScore: number,
  opponentScore: number,
  maximumScoreEnabled: boolean,
  maximumScore: number | null
) {
  const raw = ownScore - opponentScore;
  if (maximumScoreEnabled && maximumScore != null) {
    return Math.max(-maximumScore, Math.min(maximumScore, raw));
  }
  return raw;
}
