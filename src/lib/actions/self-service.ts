"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { resolveMatchSubmission } from "@/lib/match/submit";
import { setFlash } from "@/lib/flash";

const startSchema = z.object({
  token: z.string().min(1),
  selfPlayerId: z.string().min(1),
  opponentPlayerId: z.string().min(1),
  player1Score: z.coerce.number().int().min(0),
  player2Score: z.coerce.number().int().min(0),
});

// Practice-only self-service scoring: no staff-created Round required at all (spec: players
// can log a game any time). Public/no-auth by design, same as the table-QR flow — "who am I"
// comes from the selfPlayerId the page already scoped via its ?me= search param, not from a
// session. Creates the ad-hoc Match (always player1 = the initiator) AND records the
// initiator's own submission in one step, via the same resolveMatchSubmission engine the
// table-QR flow uses, so the dual-confirm rule can never drift between the two flows.
export async function startSelfServiceMatch(formData: FormData) {
  const parsed = startSchema.safeParse({
    token: formData.get("token"),
    selfPlayerId: formData.get("selfPlayerId"),
    opponentPlayerId: formData.get("opponentPlayerId"),
    player1Score: formData.get("player1Score"),
    player2Score: formData.get("player2Score"),
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((i) => i.message).join(", "));
  }
  const { token, selfPlayerId, opponentPlayerId, player1Score, player2Score } = parsed.data;
  if (selfPlayerId === opponentPlayerId) {
    throw new Error("เลือกคู่แข่งคนอื่นที่ไม่ใช่ตัวเอง");
  }

  const tournament = await prisma.tournament.findUnique({ where: { selfServiceToken: token } });
  if (!tournament || tournament.mode !== "PRACTICE") {
    throw new Error("ไม่พบลิงก์นี้");
  }

  // The page's <select> only ever lists valid roster options, but a forged POST must not be
  // trusted blindly — re-check both ids actually belong to this tournament and are ACTIVE.
  const players = await prisma.tournamentPlayer.findMany({
    where: {
      tournamentId: tournament.id,
      id: { in: [selfPlayerId, opponentPlayerId] },
      status: "ACTIVE",
    },
  });
  if (players.length !== 2) {
    throw new Error("ไม่พบผู้เล่นที่ระบุในทัวร์นาเมนต์นี้");
  }

  const match = await prisma.match.create({
    data: {
      tournamentId: tournament.id,
      roundId: null,
      tableId: null,
      player1Id: selfPlayerId,
      player2Id: opponentPlayerId,
      isBye: false,
      maximumScoreEnabled: true,
      maximumScore: tournament.defaultMaximumScore,
      status: "PENDING",
    },
  });

  await resolveMatchSubmission(match.id, "PLAYER1", player1Score, player2Score);

  await setFlash("ส่งผลแล้ว รอคู่แข่งกรอกผลเพื่อยืนยัน");
  revalidatePath(`/practice/${token}`);
}

const submitSchema = z.object({
  token: z.string().min(1),
  matchId: z.string().min(1),
  side: z.enum(["PLAYER1", "PLAYER2"]),
  player1Score: z.coerce.number().int().min(0),
  player2Score: z.coerce.number().int().min(0),
});

// Confirm/dispute step for an ad-hoc match — same dual-submission comparison as
// submitMatchResult, but never calls maybeCompleteRound since self-service matches have no
// Round at all.
export async function submitSelfServiceResult(formData: FormData) {
  const parsed = submitSchema.safeParse({
    token: formData.get("token"),
    matchId: formData.get("matchId"),
    side: formData.get("side"),
    player1Score: formData.get("player1Score"),
    player2Score: formData.get("player2Score"),
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((i) => i.message).join(", "));
  }
  const { token, matchId, side, player1Score, player2Score } = parsed.data;

  const outcome = await resolveMatchSubmission(matchId, side, player1Score, player2Score);

  if (outcome.kind === "already-confirmed" || outcome.kind === "already-bye") {
    await setFlash("ผลถูกยืนยันแล้ว — หน้านี้เป็นข้อมูลเก่า กำลังแสดงผลล่าสุดให้", "error");
  } else if (outcome.kind === "waiting") {
    await setFlash("ส่งผลแล้ว รออีกฝ่ายกรอกผลเพื่อยืนยัน");
  } else if (outcome.kind === "confirmed") {
    await setFlash("ผลตรงกัน ยืนยันผลแล้ว");
  } else {
    await setFlash("ผลไม่ตรงกับอีกฝ่าย กรุณาตรวจสอบและส่งผลอีกครั้งทั้งสองฝั่ง", "error");
  }

  revalidatePath(`/practice/${token}`);
}
