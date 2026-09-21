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
  method: PairingMethod
): Promise<PairResult[]> {
  const standings = await getStandingsForPairing(tournamentId);

  switch (method) {
    case "RANDOM":
      return randomPairing(standings);
    case "KING_OF_THE_HILL":
      return kingOfTheHillPairing(standings);
    case "SWISS":
      return swissPairing(standings);
    case "ROUND_ROBIN":
      return roundRobinPairing(standings, roundNumber);
  }
}
