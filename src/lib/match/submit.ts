import "server-only";
import { prisma } from "@/lib/prisma";
import { computeResult } from "@/lib/match/result";

export type SubmitOutcome =
  | { kind: "not-found" }
  | { kind: "already-bye" }
  | { kind: "already-confirmed" }
  | { kind: "waiting" }
  | { kind: "confirmed"; roundId: string | null }
  | { kind: "conflict" };

/**
 * Core of spec §13's dual-submission compare/confirm mechanism: each side submits the full
 * result as they saw it, and only agreement between the two independent submissions confirms
 * a match. Shared by the table-QR flow (submitMatchResult) and the self-service flow
 * (submitSelfServiceResult / startSelfServiceMatch) so both stay in lockstep on how a match
 * gets CONFIRMED or flagged CONFLICT — including self-service matches, which have no Round
 * (roundId is null in the outcome for those).
 */
export async function resolveMatchSubmission(
  matchId: string,
  side: "PLAYER1" | "PLAYER2",
  player1Score: number,
  player2Score: number
): Promise<SubmitOutcome> {
  // See submitMatchResult's original comment: the FOR UPDATE lock on Match forces concurrent
  // submissions from both sides to serialize, so the upsert + compare + status-write always
  // happens against the true latest state.
  return prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<{ id: string; isBye: boolean; status: string; roundId: string | null }[]>`
      SELECT id, "isBye", status, "roundId" FROM "Match" WHERE id = ${matchId} FOR UPDATE
    `;
    const match = locked[0];
    // Gone since the page was loaded (e.g. the round was re-paired after a no-show) — a stale
    // page, not a crash; callers show the current state instead.
    if (!match) return { kind: "not-found" };
    if (match.isBye) return { kind: "already-bye" };
    if (match.status === "CONFIRMED") return { kind: "already-confirmed" };

    await tx.matchSubmission.upsert({
      where: { matchId_side: { matchId, side } },
      update: { player1Score, player2Score },
      create: { matchId, side, player1Score, player2Score },
    });

    const submissions = await tx.matchSubmission.findMany({ where: { matchId } });
    const mine = submissions.find((s) => s.side === side)!;
    const other = submissions.find((s) => s.side !== side);

    if (!other) {
      await tx.match.update({ where: { id: matchId }, data: { status: "SUBMITTED" } });
      return { kind: "waiting" };
    }

    if (other.player1Score === mine.player1Score && other.player2Score === mine.player2Score) {
      const result = computeResult(mine.player1Score, mine.player2Score);
      await tx.match.update({
        where: { id: matchId },
        data: {
          finalPlayer1Score: mine.player1Score,
          finalPlayer2Score: mine.player2Score,
          player1Result: result.player1Result,
          player2Result: result.player2Result,
          status: "CONFIRMED",
          // The "opponent didn't show" report was wrong or they arrived in time — both sides
          // just agreed on a real result, so drop any pending Bye claim.
          byeClaimedById: null,
          byeClaimedAt: null,
        },
      });
      return { kind: "confirmed", roundId: match.roundId };
    }

    await tx.match.update({ where: { id: matchId }, data: { status: "CONFLICT" } });
    return { kind: "conflict" };
  });
}
