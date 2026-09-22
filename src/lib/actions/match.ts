"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertTournamentAccess } from "@/lib/dal";
import { computeResult } from "@/lib/match/result";
import { maybeCompleteRound } from "@/lib/match/round-completion";
import { setFlash } from "@/lib/flash";

const submitSchema = z.object({
  matchId: z.string().min(1),
  side: z.enum(["PLAYER1", "PLAYER2"]),
  player1Score: z.coerce.number().int().min(0),
  player2Score: z.coerce.number().int().min(0),
  qrToken: z.string().min(1),
});

// Spec §13: no single side's report is trusted alone. Each side submits the FULL result as
// they saw it; only when both independent submissions agree does the match auto-confirm.
// Public — a player at the table has no account, so there is deliberately no auth check
// here, only a validity/state check on the match itself.
export async function submitMatchResult(formData: FormData) {
  const parsed = submitSchema.safeParse({
    matchId: formData.get("matchId"),
    side: formData.get("side"),
    player1Score: formData.get("player1Score"),
    player2Score: formData.get("player2Score"),
    qrToken: formData.get("qrToken"),
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((i) => i.message).join(", "));
  }
  const { matchId, side, player1Score, player2Score, qrToken } = parsed.data;

  // Two devices (one per side) can submit within milliseconds of each other, e.g. both
  // resubmitting right after a Score Conflict. Without a lock, both could read the other
  // side's submission as "missing"/stale at the same time and each decide the comparison on
  // its own, leaving the match on the wrong status. The FOR UPDATE lock on the Match row
  // forces the second submission to wait and then re-read fresh data, so the upsert + compare
  // + status-write always happens against the true latest state.
  const outcome = await prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<{ id: string; isBye: boolean; status: string; roundId: string }[]>`
      SELECT id, "isBye", status, "roundId" FROM "Match" WHERE id = ${matchId} FOR UPDATE
    `;
    const match = locked[0];
    if (!match) throw new Error("ไม่พบ Match");
    // Expected, not exceptional: a stale page (the match was already confirmed by the other
    // side, or turned out to be a Bye) still shows an active form. This used to throw, which
    // with no error boundary crashed the whole page ("This page couldn't load") instead of
    // just showing the now-current state — so it's handled as a normal outcome instead.
    if (match.isBye) return { kind: "already-bye" as const };
    if (match.status === "CONFIRMED") return { kind: "already-confirmed" as const };

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
      return { kind: "waiting" as const };
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
        },
      });
      return { kind: "confirmed" as const, roundId: match.roundId };
    }

    await tx.match.update({ where: { id: matchId }, data: { status: "CONFLICT" } });
    return { kind: "conflict" as const };
  });

  if (outcome.kind === "already-confirmed" || outcome.kind === "already-bye") {
    await setFlash("ผลถูกยืนยันแล้ว — หน้านี้เป็นข้อมูลเก่า กำลังแสดงผลล่าสุดให้", "error");
  } else if (outcome.kind === "waiting") {
    await setFlash("ส่งผลแล้ว รออีกฝ่ายกรอกผลเพื่อยืนยัน");
  } else if (outcome.kind === "confirmed") {
    await maybeCompleteRound(outcome.roundId);
    await setFlash("ผลตรงกัน ยืนยันผลแล้ว");
  } else {
    await setFlash("ผลไม่ตรงกับอีกฝ่าย รอ Admin/Staff ตรวจสอบ", "error");
  }

  revalidatePath(`/table/${qrToken}`);
}

const adminSetSchema = z.object({
  matchId: z.string().min(1),
  player1Score: z.coerce.number().int().min(0),
  player2Score: z.coerce.number().int().min(0),
});

// Spec §14: Admin/Staff can set or correct any match's result directly — used both to
// resolve a Score Conflict and for general after-the-fact corrections.
export async function adminSetMatchResult(formData: FormData) {
  const parsed = adminSetSchema.safeParse({
    matchId: formData.get("matchId"),
    player1Score: formData.get("player1Score"),
    player2Score: formData.get("player2Score"),
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((i) => i.message).join(", "));
  }
  const { matchId, player1Score, player2Score } = parsed.data;

  const match = await prisma.match.findUniqueOrThrow({
    where: { id: matchId },
    include: { round: true },
  });
  const admin = await assertTournamentAccess(match.round.tournamentId);
  if (match.isBye) {
    throw new Error("Match นี้เป็น Bye ไม่ต้องกรอกคะแนน");
  }

  const result = computeResult(player1Score, player2Score);
  await prisma.match.update({
    where: { id: matchId },
    data: {
      finalPlayer1Score: player1Score,
      finalPlayer2Score: player2Score,
      player1Result: result.player1Result,
      player2Result: result.player2Result,
      status: "CONFIRMED",
      editedByAdminId: admin.id,
    },
  });
  await maybeCompleteRound(match.roundId);

  await setFlash("บันทึกผลแล้ว");
  revalidatePath(`/admin/tournaments/${match.round.tournamentId}/rounds/${match.roundId}`);
  revalidatePath(`/admin/tournaments/${match.round.tournamentId}/scoreboard`);
  revalidatePath(`/t/${match.round.tournamentId}`);
}
