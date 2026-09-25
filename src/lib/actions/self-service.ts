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

  // Before opening a new match, look at the ad-hoc matches between these two that are still
  // waiting on a second report. The form's scores are from the initiator's point of view
  // (player1 = self), so re-orient them to each existing match's own player1/player2.
  const pendingBetween = await prisma.match.findMany({
    where: {
      tournamentId: tournament.id,
      roundId: null,
      status: "SUBMITTED",
      OR: [
        { player1Id: selfPlayerId, player2Id: opponentPlayerId },
        { player1Id: opponentPlayerId, player2Id: selfPlayerId },
      ],
    },
    include: { submissions: true },
    orderBy: { createdAt: "desc" },
  });
  for (const m of pendingBetween) {
    const selfSide = m.player1Id === selfPlayerId ? "PLAYER1" : "PLAYER2";
    const p1 = selfSide === "PLAYER1" ? player1Score : player2Score;
    const p2 = selfSide === "PLAYER1" ? player2Score : player1Score;
    const mine = m.submissions.find((s) => s.side === selfSide);
    const theirs = m.submissions.find((s) => s.side !== selfSide);
    const sameAs = (s: { player1Score: number; player2Score: number }) =>
      s.player1Score === p1 && s.player2Score === p2;

    // The opponent already logged this very game from their own phone with the same result —
    // confirm that match rather than opening a second copy that nobody would ever confirm.
    if (!mine && theirs && sameAs(theirs)) {
      await resolveMatchSubmission(m.id, selfSide, p1, p2);
      await setFlash("ผลตรงกับที่คู่แข่งส่งไว้ ยืนยันผลแล้ว");
      revalidatePath(`/practice/play/${token}`);
      return;
    }

    // Same result re-sent moments after the first one (double tap, retry on a slow network) —
    // a real game takes far longer than this window, so it's a duplicate, not a new game.
    if (mine && !theirs && sameAs(mine) && Date.now() - m.createdAt.getTime() < 2 * 60 * 1000) {
      await setFlash("ส่งผลนี้ไปแล้ว รอคู่แข่งกรอกผลเพื่อยืนยัน");
      revalidatePath(`/practice/play/${token}`);
      return;
    }
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
  revalidatePath(`/practice/play/${token}`);
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

  // The link's token only grants this practice tournament's ad-hoc games — never a match from
  // another tournament, or a staff-run round's match (which has its own table-QR flow).
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: { roundId: true, tournament: { select: { selfServiceToken: true, mode: true } } },
  });
  if (
    !match ||
    match.roundId !== null ||
    match.tournament.mode !== "PRACTICE" ||
    match.tournament.selfServiceToken !== token
  ) {
    await setFlash("หน้านี้เป็นข้อมูลเก่า กำลังแสดงผลล่าสุดให้", "error");
    revalidatePath(`/practice/play/${token}`);
    return;
  }

  const outcome = await resolveMatchSubmission(matchId, side, player1Score, player2Score);

  if (outcome.kind === "not-found") {
    await setFlash("หน้านี้เป็นข้อมูลเก่า กำลังแสดงผลล่าสุดให้", "error");
  } else if (outcome.kind === "already-confirmed" || outcome.kind === "already-bye") {
    await setFlash("ผลถูกยืนยันแล้ว — หน้านี้เป็นข้อมูลเก่า กำลังแสดงผลล่าสุดให้", "error");
  } else if (outcome.kind === "waiting") {
    await setFlash("ส่งผลแล้ว รออีกฝ่ายกรอกผลเพื่อยืนยัน");
  } else if (outcome.kind === "confirmed") {
    await setFlash("ผลตรงกัน ยืนยันผลแล้ว");
  } else {
    await setFlash("ผลไม่ตรงกับอีกฝ่าย ตรวจสอบกันอีกครั้งแล้วแก้ผลให้ตรงกัน", "error");
  }

  revalidatePath(`/practice/play/${token}`);
}
