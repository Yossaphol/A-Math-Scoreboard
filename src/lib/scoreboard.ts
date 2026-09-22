import "server-only";
import { prisma } from "@/lib/prisma";
import { cappedDiff } from "@/lib/match/diff";

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

  // ownScoreTotal/opponentScoreTotal always reflect the RAW score entered — only
  // cumulativeDiff is computed from the per-game capped spread (cappedDiff above).
  function apply(
    playerId: string,
    result: "WIN" | "TIE" | "LOSS",
    ownScoreRaw: number,
    opponentScoreRaw: number,
    diffContribution: number
  ) {
    const row = rows.get(playerId);
    if (!row) return;
    row.gamesPlayed += 1;
    row.ownScoreTotal += ownScoreRaw;
    row.opponentScoreTotal += opponentScoreRaw;
    row.cumulativeDiff += diffContribution;
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
      apply(m.player1Id, "WIN", 100, 0, 100);
      continue;
    }
    if (m.finalPlayer1Score == null || m.finalPlayer2Score == null || !m.player1Result || !m.player2Result) {
      continue;
    }

    const p1Raw = m.finalPlayer1Score;
    const p2Raw = m.finalPlayer2Score;
    const diff = cappedDiff(p1Raw, p2Raw, m.round.maximumScoreEnabled, m.round.maximumScore);

    apply(m.player1Id, m.player1Result, p1Raw, p2Raw, diff);
    apply(m.player2Id, m.player2Result, p2Raw, p1Raw, -diff);
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
