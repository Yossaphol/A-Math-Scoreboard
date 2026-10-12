import "server-only";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import type { TournamentMode } from "@/generated/prisma/enums";
import { roundLimitOf } from "@/lib/tournament-limits";
import { publicTournamentListPath, publicTournamentPath } from "@/lib/tournament-path";

type CompletedTournament = { id: string; mode: TournamentMode };

// A Round is COMPLETED once every one of its Matches has reached a terminal state
// (CONFIRMED or BYE). This is what lets startPairing know the previous round is truly done
// before a new one can be generated, and lets the QR lookup find the one active round.
//
// When the Tournament has a set number of rounds (spec §7) and this was the last one, the
// Tournament itself is finished too — status flips to COMPLETED on its own.
//
// Run it in the SAME transaction that confirms a match (resolveMatchSubmission,
// adminSetMatchResult): as a separate step afterwards, any failure in between (a dropped DB
// connection, a function timeout) left a fully-played round stuck as CONFIRMED for good —
// blocking the next round. The Round row lock makes two matches confirmed at the same moment
// serialize here, so the second one always sees the first as done.
export async function completeRoundIfDone(
  tx: Prisma.TransactionClient,
  roundId: string
): Promise<{ tournamentCompleted: CompletedTournament | null }> {
  const locked = await tx.$queryRaw<{ status: string }[]>`
    SELECT status FROM "Round" WHERE id = ${roundId} FOR UPDATE
  `;
  if (locked[0]?.status !== "CONFIRMED") return { tournamentCompleted: null };

  const unfinished = await tx.match.count({
    where: { roundId, status: { notIn: ["CONFIRMED", "BYE"] } },
  });
  if (unfinished > 0) return { tournamentCompleted: null };

  const round = await tx.round.update({
    where: { id: roundId },
    data: { status: "COMPLETED" },
    include: { tournament: true },
  });

  const { tournament } = round;
  const roundLimit = roundLimitOf(tournament);
  if (roundLimit == null || round.roundNumber < roundLimit || tournament.status === "COMPLETED") {
    return { tournamentCompleted: null };
  }
  await tx.tournament.update({ where: { id: tournament.id }, data: { status: "COMPLETED" } });
  return { tournamentCompleted: { id: tournament.id, mode: tournament.mode } };
}

/** Call from a Server Action after a transaction that finished the Tournament. */
export function revalidateTournamentStatus(t: CompletedTournament) {
  revalidatePath(`/admin/tournaments/${t.id}`, "layout");
  revalidatePath("/admin/tournaments");
  revalidatePath(publicTournamentPath(t), "layout");
  revalidatePath(publicTournamentListPath(t.mode));
}

/** Standalone version for actions that change a round outside a match confirmation. */
export async function maybeCompleteRound(roundId: string) {
  const { tournamentCompleted } = await prisma.$transaction((tx) => completeRoundIfDone(tx, roundId));
  if (tournamentCompleted) revalidateTournamentStatus(tournamentCompleted);
}

/**
 * Self-healing safety net: completes any round of this Tournament that is fully played but
 * still marked CONFIRMED (left behind by the old two-step flow, or any future failure).
 * Cheap enough to run on every admin page load. Safe to call while rendering: no interactive
 * transaction and no revalidation — each statement is atomic and idempotent on its own, and
 * the page reading data right after it already sees the fixed state.
 */
export async function healStuckRounds(tournamentId: string) {
  const healed = await prisma.round.updateMany({
    where: {
      tournamentId,
      status: "CONFIRMED",
      matches: { none: { status: { notIn: ["CONFIRMED", "BYE"] } } },
    },
    data: { status: "COMPLETED" },
  });
  if (healed.count === 0) return;

  // Same rule as completeRoundIfDone: the last round of a set-length Tournament finishes it.
  const [tournament, lastRound] = await Promise.all([
    prisma.tournament.findUniqueOrThrow({ where: { id: tournamentId } }),
    prisma.round.findFirst({ where: { tournamentId }, orderBy: { roundNumber: "desc" } }),
  ]);
  const roundLimit = roundLimitOf(tournament);
  if (
    roundLimit != null &&
    lastRound?.status === "COMPLETED" &&
    lastRound.roundNumber >= roundLimit &&
    tournament.status !== "COMPLETED"
  ) {
    await prisma.tournament.update({ where: { id: tournamentId }, data: { status: "COMPLETED" } });
  }
}
