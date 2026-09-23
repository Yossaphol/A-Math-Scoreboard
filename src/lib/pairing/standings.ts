import "server-only";
import { prisma } from "@/lib/prisma";
import { cappedDiff } from "@/lib/match/diff";
import { getMaxScoreConfig } from "@/lib/match/max-score-config";
import { BYE_SCORE } from "@/lib/match/bye";
import type { Standing } from "./types";

/**
 * Standings used as pairing input — spec §9.5: must come from CONFIRMED matches only,
 * and Withdrawn players (spec §9.1/§19) are excluded from the pool entirely.
 *
 * `excludeRoundId` leaves one Round's results out — used when re-pairing a Round that's
 * already under way (repairRoundForAbsences), so it's paired on the standings from before
 * that Round, exactly like it was originally generated.
 */
export async function getStandingsForPairing(
  tournamentId: string,
  options: { excludeRoundId?: string } = {}
): Promise<Standing[]> {
  const players = await prisma.tournamentPlayer.findMany({
    where: { tournamentId, status: "ACTIVE" },
    orderBy: { tournamentPlayerNo: "asc" },
  });

  const map = new Map<string, Standing>();
  for (const p of players) {
    map.set(p.id, {
      id: p.id,
      tournamentPlayerNo: p.tournamentPlayerNo,
      points: 0,
      diff: 0,
      opponents: new Set(),
      hadBye: false,
    });
  }

  // Queried directly by tournamentId (not through round: { tournamentId }) so self-service
  // ad-hoc matches (roundId null, spec: Practice self-service needs no staff Round) are
  // included too — Scoreboard and pairing Standings must stay in lockstep on this.
  const excludeRound = options.excludeRoundId
    ? { OR: [{ roundId: null }, { roundId: { not: options.excludeRoundId } }] }
    : {};
  const matches = await prisma.match.findMany({
    where: { tournamentId, status: { in: ["CONFIRMED", "BYE"] }, ...excludeRound },
    include: { round: true },
  });

  for (const m of matches) {
    const p1 = map.get(m.player1Id);
    const p2 = m.player2Id ? map.get(m.player2Id) : undefined;

    if (m.isBye || !m.player2Id) {
      // Spec §19: Bye = W, Diff +100.
      if (p1) {
        p1.points += 2;
        p1.diff += BYE_SCORE;
        p1.hadBye = true;
      }
      continue;
    }

    if (p1) p1.opponents.add(m.player2Id);
    if (p2) p2.opponents.add(m.player1Id);

    if (
      m.finalPlayer1Score == null ||
      m.finalPlayer2Score == null ||
      !m.player1Result ||
      !m.player2Result
    ) {
      continue;
    }

    const cfg = getMaxScoreConfig(m);
    const diff = cappedDiff(m.finalPlayer1Score, m.finalPlayer2Score, cfg.enabled, cfg.max);

    if (p1) {
      p1.diff += diff;
      p1.points += m.player1Result === "WIN" ? 2 : m.player1Result === "TIE" ? 1 : 0;
    }
    if (p2) {
      p2.diff += -diff;
      p2.points += m.player2Result === "WIN" ? 2 : m.player2Result === "TIE" ? 1 : 0;
    }
  }

  // No-shows (RoundAbsence): L 0-100 — no points, Diff -100. Same rule as the Scoreboard.
  const absences = await prisma.roundAbsence.findMany({
    where: {
      tournamentId,
      round: { status: { in: ["CONFIRMED", "COMPLETED"] } },
      ...(options.excludeRoundId ? { roundId: { not: options.excludeRoundId } } : {}),
    },
  });
  for (const a of absences) {
    const s = map.get(a.tournamentPlayerId);
    if (s) s.diff -= BYE_SCORE;
  }

  return Array.from(map.values());
}
