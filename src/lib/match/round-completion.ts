import "server-only";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { roundLimitOf } from "@/lib/tournament-limits";
import { publicTournamentListPath, publicTournamentPath } from "@/lib/tournament-path";

// A Round is COMPLETED once every one of its Matches has reached a terminal state
// (CONFIRMED or BYE). This is what lets startPairing know the previous round is truly done
// before a new one can be generated, and lets the QR lookup find the one active round.
//
// When the Tournament has a set number of rounds (spec §7) and this was the last one, the
// Tournament itself is finished too — status flips to COMPLETED on its own.
export async function maybeCompleteRound(roundId: string) {
  const unfinished = await prisma.match.count({
    where: { roundId, status: { notIn: ["CONFIRMED", "BYE"] } },
  });
  if (unfinished > 0) return;

  const round = await prisma.round.update({
    where: { id: roundId },
    data: { status: "COMPLETED" },
    include: { tournament: true },
  });

  const { tournament } = round;
  const roundLimit = roundLimitOf(tournament);
  if (roundLimit == null || round.roundNumber < roundLimit || tournament.status === "COMPLETED") return;

  await prisma.tournament.update({ where: { id: tournament.id }, data: { status: "COMPLETED" } });
  revalidatePath(`/admin/tournaments/${tournament.id}`, "layout");
  revalidatePath("/admin/tournaments");
  revalidatePath(publicTournamentPath(tournament), "layout");
  revalidatePath(publicTournamentListPath(tournament.mode));
}
