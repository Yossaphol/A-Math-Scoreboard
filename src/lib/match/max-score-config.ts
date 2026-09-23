import "server-only";

type MaxScoreSource = {
  roundId: string | null;
  round: { maximumScoreEnabled: boolean; maximumScore: number | null } | null;
  maximumScoreEnabled: boolean | null;
  maximumScore: number | null;
};

/**
 * Round-based matches keep reading their Maximum Score cap from Round (unchanged). A
 * self-service ad-hoc match (roundId null) has no Round to hold that, so it carries its own
 * frozen snapshot instead. Single place Scoreboard and Standings both call so they can never
 * disagree on which number to cap a game's spread by.
 */
export function getMaxScoreConfig(m: MaxScoreSource): { enabled: boolean; max: number | null } {
  if (m.roundId && m.round) {
    return { enabled: m.round.maximumScoreEnabled, max: m.round.maximumScore };
  }
  return { enabled: m.maximumScoreEnabled ?? true, max: m.maximumScore ?? null };
}
