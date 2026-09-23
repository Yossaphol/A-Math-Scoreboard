"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertTournamentAccess } from "@/lib/dal";
import { computeResult } from "@/lib/match/result";
import { resolveMatchSubmission } from "@/lib/match/submit";
import { maybeCompleteRound } from "@/lib/match/round-completion";
import { setFlash } from "@/lib/flash";
import { publicTournamentPath } from "@/lib/tournament-path";

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

  // Expected, not exceptional: a stale page (the match was already confirmed by the other
  // side, or turned out to be a Bye) still shows an active form. This used to throw, which
  // with no error boundary crashed the whole page ("This page couldn't load") instead of
  // just showing the now-current state — so resolveMatchSubmission returns it as a normal
  // outcome instead.
  const outcome = await resolveMatchSubmission(matchId, side, player1Score, player2Score);

  if (outcome.kind === "already-confirmed" || outcome.kind === "already-bye") {
    await setFlash("ผลถูกยืนยันแล้ว — หน้านี้เป็นข้อมูลเก่า กำลังแสดงผลล่าสุดให้", "error");
  } else if (outcome.kind === "waiting") {
    await setFlash("ส่งผลแล้ว รออีกฝ่ายกรอกผลเพื่อยืนยัน");
  } else if (outcome.kind === "confirmed") {
    if (outcome.roundId) await maybeCompleteRound(outcome.roundId);
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
    include: { tournament: { select: { mode: true } } },
  });
  const admin = await assertTournamentAccess(match.tournamentId);
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
  if (match.roundId) {
    await maybeCompleteRound(match.roundId);
    revalidatePath(`/admin/tournaments/${match.tournamentId}/rounds/${match.roundId}`);
  }

  await setFlash("บันทึกผลแล้ว");
  revalidatePath(`/admin/tournaments/${match.tournamentId}/scoreboard`);
  revalidatePath(publicTournamentPath({ id: match.tournamentId, mode: match.tournament.mode }));
}
