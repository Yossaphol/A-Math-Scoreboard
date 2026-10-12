import "server-only";
import { prisma } from "@/lib/prisma";

// How many CONFIRMED games each player started First / Second — what the Scoreboard shows.
export async function getFirstSecondCounts(
  tournamentId: string
): Promise<Map<string, { first: number; second: number }>> {
  const matches = await prisma.match.findMany({
    where: {
      round: { tournamentId },
      status: "CONFIRMED",
      firstPlayerId: { not: null },
      secondPlayerId: { not: null },
    },
    select: { firstPlayerId: true, secondPlayerId: true },
  });

  const counts = new Map<string, { first: number; second: number }>();
  const entry = (id: string) => {
    let c = counts.get(id);
    if (!c) counts.set(id, (c = { first: 0, second: 0 }));
    return c;
  };
  for (const m of matches) {
    if (m.firstPlayerId) entry(m.firstPlayerId).first += 1;
    if (m.secondPlayerId) entry(m.secondPlayerId).second += 1;
  }
  return counts;
}

// Spec §11: First = 2, Second = 1, accumulated across all CONFIRMED games. Whoever has the
// higher total gets First next time (balances out who starts first/second).
export async function getFirstSecondTotals(tournamentId: string): Promise<Map<string, number>> {
  const counts = await getFirstSecondCounts(tournamentId);
  return new Map([...counts].map(([id, c]) => [id, c.first * 2 + c.second]));
}

export function assignFirstSecond(
  player1Id: string,
  player2Id: string,
  totals: Map<string, number>
): { firstPlayerId: string; secondPlayerId: string } {
  const t1 = totals.get(player1Id) ?? 0;
  const t2 = totals.get(player2Id) ?? 0;

  if (t1 === t2) {
    // Spec §11: tie => random.
    return Math.random() < 0.5
      ? { firstPlayerId: player1Id, secondPlayerId: player2Id }
      : { firstPlayerId: player2Id, secondPlayerId: player1Id };
  }
  // Higher accumulated First/Second score gets Second this time.
  return t1 > t2
    ? { firstPlayerId: player2Id, secondPlayerId: player1Id }
    : { firstPlayerId: player1Id, secondPlayerId: player2Id };
}
