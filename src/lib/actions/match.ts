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

  const match = await prisma.match.findUniqueOrThrow({ where: { id: matchId } });
  if (match.isBye || match.status === "CONFIRMED") {
    throw new Error("Match นี้ปิดรับผลแล้ว");
  }

  await prisma.matchSubmission.upsert({
    where: { matchId_side: { matchId, side } },
    update: { player1Score, player2Score },
    create: { matchId, side, player1Score, player2Score },
  });

  const otherSide = side === "PLAYER1" ? "PLAYER2" : "PLAYER1";
  const otherSubmission = await prisma.matchSubmission.findUnique({
    where: { matchId_side: { matchId, side: otherSide } },
  });

  if (!otherSubmission) {
    await prisma.match.update({ where: { id: matchId }, data: { status: "SUBMITTED" } });
    await setFlash("ส่งผลแล้ว รออีกฝ่ายกรอกผลเพื่อยืนยัน");
  } else if (
    otherSubmission.player1Score === player1Score &&
    otherSubmission.player2Score === player2Score
  ) {
    const result = computeResult(player1Score, player2Score);
    await prisma.match.update({
      where: { id: matchId },
      data: {
        finalPlayer1Score: player1Score,
        finalPlayer2Score: player2Score,
        player1Result: result.player1Result,
        player2Result: result.player2Result,
        status: "CONFIRMED",
      },
    });
    await maybeCompleteRound(match.roundId);
    await setFlash("ผลตรงกัน ยืนยันผลแล้ว");
  } else {
    await prisma.match.update({ where: { id: matchId }, data: { status: "CONFLICT" } });
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
