import "server-only";
import { prisma } from "@/lib/prisma";
import { cappedDiff } from "@/lib/match/diff";
import type { Standing } from "./types";

/**
 * Standings used as pairing input — spec §9.5: must come from CONFIRMED matches only,
 * and Withdrawn players (spec §9.1/§19) are excluded from the pool entirely.
 */
export async function getStandingsForPairing(tournamentId: string): Promise<Standing[]> {
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

  const matches = await prisma.match.findMany({
    where: { round: { tournamentId }, status: { in: ["CONFIRMED", "BYE"] } },
    include: { round: true },
  });

  for (const m of matches) {
    const p1 = map.get(m.player1Id);
    const p2 = m.player2Id ? map.get(m.player2Id) : undefined;

    if (m.isBye || !m.player2Id) {
      // Spec §19: Bye = W, Diff +100.
      if (p1) {
        p1.points += 2;
        p1.diff += 100;
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

    const diff = cappedDiff(
      m.finalPlayer1Score,
      m.finalPlayer2Score,
      m.round.maximumScoreEnabled,
      m.round.maximumScore
    );

    if (p1) {
      p1.diff += diff;
      p1.points += m.player1Result === "WIN" ? 2 : m.player1Result === "TIE" ? 1 : 0;
    }
    if (p2) {
      p2.diff += -diff;
      p2.points += m.player2Result === "WIN" ? 2 : m.player2Result === "TIE" ? 1 : 0;
    }
  }

  return Array.from(map.values());
}
