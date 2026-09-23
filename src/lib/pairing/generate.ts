import "server-only";
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
