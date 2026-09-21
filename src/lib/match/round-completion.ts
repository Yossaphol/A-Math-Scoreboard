import "server-only";
import { prisma } from "@/lib/prisma";

// A Round is COMPLETED once every one of its Matches has reached a terminal state
// (CONFIRMED or BYE). This is what lets startPairing know the previous round is truly done
// before a new one can be generated, and lets the QR lookup find the one active round.
export async function maybeCompleteRound(roundId: string) {
  const unfinished = await prisma.match.count({
    where: { roundId, status: { notIn: ["CONFIRMED", "BYE"] } },
  });
  if (unfinished === 0) {
    await prisma.round.update({ where: { id: roundId }, data: { status: "COMPLETED" } });
  }
}
