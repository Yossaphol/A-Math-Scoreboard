import "server-only";
import { prisma } from "@/lib/prisma";

export type ScoreboardRow = {
  rank: number;
  tournamentPlayerId: string;
  tournamentPlayerNo: number;
  globalPlayerId: number;
  name: string;
  nickname: string | null;
  status: "ACTIVE" | "WITHDRAWN";
  gamesPlayed: number;
  wins: number;
  ties: number;
  losses: number;
  points: number;
  cumulativeDiff: number;
  ownScoreTotal: number;
  opponentScoreTotal: number;
};

// Spec §8: a Maximum Score cap only affects Game Difference, never the raw score shown.
function cappedScore(score: number, maximumScoreEnabled: boolean, maximumScore: number | null) {
  if (maximumScoreEnabled && maximumScore != null && score > maximumScore) {
    return maximumScore;
  }
  return score;
}

/**
 * Scoreboard is always derived from CONFIRMED matches only (spec §9.5) — never cached on
 * TournamentPlayer, so there is a single source of truth for W/T/L, points and diff.
 */
export async function getScoreboard(tournamentId: string): Promise<ScoreboardRow[]> {
  const players = await prisma.tournamentPlayer.findMany({
    where: { tournamentId },
    include: { globalPlayer: true },
    orderBy: { tournamentPlayerNo: "asc" },
  });

  const rows = new Map<string, ScoreboardRow>();
  for (const p of players) {
    rows.set(p.id, {
      rank: 0,
      tournamentPlayerId: p.id,
      tournamentPlayerNo: p.tournamentPlayerNo,
      globalPlayerId: p.globalPlayerId,
      name: p.globalPlayer.name,
      nickname: p.globalPlayer.nickname,
      status: p.status,
      gamesPlayed: 0,
      wins: 0,
      ties: 0,
      losses: 0,
      points: 0,
      cumulativeDiff: 0,
      ownScoreTotal: 0,
      opponentScoreTotal: 0,
    });
  }

  const matches = await prisma.match.findMany({
    where: { round: { tournamentId }, status: { in: ["CONFIRMED", "BYE"] } },
    include: { round: true },
  });

  // ownScoreTotal/opponentScoreTotal are always tracked so that Diff === ownTotal -
  // opponentTotal holds exactly, including for a Bye (spec §19: modeled as own +100, opponent
  // +0, rather than a bare diff bonus with no score behind it).
  function apply(
    playerId: string,
    result: "WIN" | "TIE" | "LOSS",
    ownScore: number,
    opponentScore: number
  ) {
    const row = rows.get(playerId);
    if (!row) return;
    row.gamesPlayed += 1;
    row.ownScoreTotal += ownScore;
    row.opponentScoreTotal += opponentScore;
    row.cumulativeDiff += ownScore - opponentScore;
    if (result === "WIN") {
      row.wins += 1;
      row.points += 2;
    } else if (result === "TIE") {
      row.ties += 1;
      row.points += 1;
    } else {
      row.losses += 1;
    }
  }

  for (const m of matches) {
    if (m.isBye || !m.player2Id) {
      // Spec §19: Bye = W, Diff +100.
      apply(m.player1Id, "WIN", 100, 0);
      continue;
    }
    if (m.finalPlayer1Score == null || m.finalPlayer2Score == null || !m.player1Result || !m.player2Result) {
      continue;
    }

    const p1 = cappedScore(m.finalPlayer1Score, m.round.maximumScoreEnabled, m.round.maximumScore);
    const p2 = cappedScore(m.finalPlayer2Score, m.round.maximumScoreEnabled, m.round.maximumScore);

    apply(m.player1Id, m.player1Result, p1, p2);
    apply(m.player2Id, m.player2Result, p2, p1);
  }

  const sorted = Array.from(rows.values()).sort(
    (a, b) => b.points - a.points || b.cumulativeDiff - a.cumulativeDiff
  );
  // "#" is the standing rank (1, 2, 3, ...), not the fixed Tournament Player No — the latter
  // is shown next to the player's name instead.
  sorted.forEach((row, i) => {
    row.rank = i + 1;
  });
  return sorted;
}
