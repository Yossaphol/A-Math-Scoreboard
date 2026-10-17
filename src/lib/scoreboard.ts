import "server-only";
import { prisma } from "@/lib/prisma";
import { cappedDiff } from "@/lib/match/diff";
import { getMaxScoreConfig } from "@/lib/match/max-score-config";
import { BYE_SCORE } from "@/lib/match/bye";

export type ScoreboardRow = {
  rank: number | null; // null: Withdrawn — listed last, unranked
  tournamentPlayerId: string;
  tournamentPlayerNo: number;
  globalPlayerId: number;
  name: string;
  nickname: string | null;
  status: "ACTIVE" | "WITHDRAWN";
  groupId: string | null;
  groupName: string | null;
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
    include: { globalPlayer: true, group: true },
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
      groupId: p.groupId,
      groupName: p.group?.name ?? null,
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

  // Queried directly by tournamentId (not through round: { tournamentId }) so self-service
  // ad-hoc matches (roundId null) are included too.
  const matches = await prisma.match.findMany({
    where: { tournamentId, status: { in: ["CONFIRMED", "BYE"] } },
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
      apply(m.player1Id, "WIN", BYE_SCORE, 0, BYE_SCORE);
      continue;
    }
    if (m.finalPlayer1Score == null || m.finalPlayer2Score == null || !m.player1Result || !m.player2Result) {
      continue;
    }

    const p1Raw = m.finalPlayer1Score;
    const p2Raw = m.finalPlayer2Score;
    const cfg = getMaxScoreConfig(m);
    const diff = cappedDiff(p1Raw, p2Raw, cfg.enabled, cfg.max);

    apply(m.player1Id, m.player1Result, p1Raw, p2Raw, diff);
    apply(m.player2Id, m.player2Result, p2Raw, p1Raw, -diff);
  }

  // No-shows (RoundAbsence) forfeit: L 0-100, Diff -100 — counted once their Round is
  // confirmed, same as that Round's matches.
  const absences = await prisma.roundAbsence.findMany({
    where: { tournamentId, round: { status: { in: ["CONFIRMED", "COMPLETED"] } } },
  });
  for (const a of absences) {
    apply(a.tournamentPlayerId, "LOSS", 0, BYE_SCORE, -BYE_SCORE);
  }

  return rankRows(Array.from(rows.values()));
}

/**
 * Sorts by Points, then Diff, and numbers the ranks — on whatever subset it's given, so the
 * same rule ranks the whole field or a single group. Withdrawn players go last, unranked.
 * Returns new row objects.
 */
export function rankRows(rows: ScoreboardRow[]): ScoreboardRow[] {
  const byStanding = (a: ScoreboardRow, b: ScoreboardRow) =>
    b.points - a.points || b.cumulativeDiff - a.cumulativeDiff;
  const active = rows.filter((r) => r.status !== "WITHDRAWN").map((r) => ({ ...r })).sort(byStanding);
  const withdrawn = rows
    .filter((r) => r.status === "WITHDRAWN")
    .map((r) => ({ ...r, rank: null }))
    .sort(byStanding);
  // "#" is the standing rank, not the fixed Tournament Player No (shown next to the name
  // instead). Players level on both points and Diff share a rank (1, 2, 2, 4) rather than
  // being split by an order the scoring rules don't define.
  active.forEach((row, i) => {
    const prev = active[i - 1];
    row.rank =
      prev && prev.points === row.points && prev.cumulativeDiff === row.cumulativeDiff ? prev.rank : i + 1;
  });
  return [...active, ...withdrawn];
}

export type ScoreboardSection = {
  // null: the whole field, or (while split) the players not in any group.
  group: { id: string; name: string } | null;
  rows: ScoreboardRow[];
};

export type ScoreboardView = {
  rows: ScoreboardRow[]; // everyone shown (see hideWithdrawn), overall rank
  allRows: ScoreboardRow[]; // everyone, Withdrawn included — for per-player stats lookups
  groups: { id: string; name: string; playerCount: number }[];
  // The latest Round paired within groups — show one table per group until a Round doesn't.
  split: boolean;
  sections: ScoreboardSection[];
};

/**
 * The Scoreboard as it should be displayed. While the latest Round is split by group, one
 * table per group, ranked within the group. Otherwise one table for everyone — or, with
 * `groupFilter`, just that group's players, ranked among themselves (points always carry
 * over in full; a group never has a separate tally).
 *
 * `tabsOnly` (the admin Scoreboard): never stack one table per group — always one table,
 * everyone or the `groupFilter` group, whether or not the latest Round is split.
 *
 * `hideWithdrawn`: leave Withdrawn players out of the tables and counts (the
 * showWithdrawnAdmin / showWithdrawnPublic settings).
 */
export async function getScoreboardView(
  tournamentId: string,
  groupFilter?: string | null,
  { tabsOnly = false, hideWithdrawn = false }: { tabsOnly?: boolean; hideWithdrawn?: boolean } = {}
): Promise<ScoreboardView> {
  const [allRows, groupList, latestRound] = await Promise.all([
    getScoreboard(tournamentId),
    prisma.tournamentGroup.findMany({
      where: { tournamentId },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true },
    }),
    prisma.round.findFirst({
      where: { tournamentId },
      orderBy: { roundNumber: "desc" },
      select: { splitByGroup: true },
    }),
  ]);
  const rows = hideWithdrawn ? allRows.filter((r) => r.status !== "WITHDRAWN") : allRows;
  const groups = groupList.map((g) => ({ ...g, playerCount: rows.filter((r) => r.groupId === g.id).length }));
  const split = groups.length > 0 && !!latestRound?.splitByGroup;

  let sections: ScoreboardSection[];
  if (split && !tabsOnly) {
    sections = groups.map((g) => ({ group: g, rows: rankRows(rows.filter((r) => r.groupId === g.id)) }));
    const ungrouped = rows.filter((r) => r.groupId == null);
    if (ungrouped.length > 0) sections.push({ group: null, rows: rankRows(ungrouped) });
  } else {
    const filtered = groups.find((g) => g.id === groupFilter);
    sections = filtered
      ? [{ group: filtered, rows: rankRows(rows.filter((r) => r.groupId === filtered.id)) }]
      : [{ group: null, rows }];
  }
  return { rows, allRows, groups, split, sections };
}
