import "server-only";
import { prisma } from "@/lib/prisma";
import type { PairResult } from "./types";
import { getStandingsForPairing } from "./standings";
import {
  randomPairing,
  swissPairing,
  kingOfTheHillPairing,
  roundRobinPairing,
} from "./algorithms";
import type { PairingMethod } from "@/generated/prisma/enums";

export async function generatePairing(
  tournamentId: string,
  roundNumber: number,
  method: PairingMethod,
  // Restrict the pairing pool to a subset of the active roster: Practice mode's "who plays
  // this round", and re-pairing the players left without an opponent after a no-show.
  // undefined means "everyone" — how every new COMPETITION round is generated.
  participantIds?: Set<string>,
  // Re-pairing a Round already under way: rank on the standings from before that Round.
  options: { excludeRoundId?: string } = {}
): Promise<PairResult[]> {
  const standings = await getStandingsForPairing(tournamentId, options);
  const pool = participantIds ? standings.filter((s) => participantIds.has(s.id)) : standings;

  switch (method) {
    case "RANDOM":
      return randomPairing(pool);
    case "KING_OF_THE_HILL":
      return kingOfTheHillPairing(pool);
    case "SWISS":
      return swissPairing(pool);
    case "ROUND_ROBIN":
      return roundRobinPairing(pool, roundNumber);
  }
}

/**
 * A Round split by group (Round.splitByGroup): each group is paired on its own, with its own
 * method, on the same standings everyone else uses — so Swiss/King of the Hill rank a group
 * by the points it has so far. An odd group gives its own lowest player the Bye; nobody is
 * ever paired across groups. Byes come last, after every group's real games.
 *
 * Refuses (throws) when a player in the pool has no group, or a group with no method — they'd
 * otherwise silently be left out of the Round.
 */
export async function generateGroupedPairing(
  tournamentId: string,
  roundNumber: number,
  groupMethods: { groupId: string; pairingMethod: PairingMethod }[],
  participantIds?: Set<string>,
  options: { excludeRoundId?: string } = {}
): Promise<PairResult[]> {
  const players = await prisma.tournamentPlayer.findMany({
    where: { tournamentId, status: "ACTIVE", ...(participantIds ? { id: { in: [...participantIds] } } : {}) },
    include: { globalPlayer: { select: { name: true } } },
    orderBy: { tournamentPlayerNo: "asc" },
  });

  const methodOf = new Map(groupMethods.map((g) => [g.groupId, g.pairingMethod]));
  const stray = players.filter((p) => p.groupId == null || !methodOf.has(p.groupId));
  if (stray.length > 0) {
    throw new Error(
      `${stray.map((p) => p.globalPlayer.name).join(", ")} ยังไม่ได้อยู่ในกลุ่มใด — เลือกกลุ่มให้ในแท็บ Players ก่อน`
    );
  }

  const games: PairResult[] = [];
  const byes: PairResult[] = [];
  for (const { groupId, pairingMethod } of groupMethods) {
    const ids = new Set(players.filter((p) => p.groupId === groupId).map((p) => p.id));
    if (ids.size === 0) continue;
    for (const pair of await generatePairing(tournamentId, roundNumber, pairingMethod, ids, options)) {
      (pair.player2Id == null ? byes : games).push(pair);
    }
  }
  return [...games, ...byes];
}
