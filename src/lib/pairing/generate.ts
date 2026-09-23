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
  // Practice-mode only: restrict the pairing pool to a chosen subset of the active roster
  // (spec: not everyone has to play every round). undefined means "everyone", reproducing
  // today's behavior exactly — always the case for COMPETITION.
  participantIds?: Set<string>
): Promise<PairResult[]> {
  const standings = await getStandingsForPairing(tournamentId);
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
