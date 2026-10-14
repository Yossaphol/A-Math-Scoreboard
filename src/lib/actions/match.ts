"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertTournamentAccess } from "@/lib/dal";
import { computeResult } from "@/lib/match/result";
import { resolveMatchSubmission } from "@/lib/match/submit";
import { completeRoundIfDone, revalidateTournamentStatus } from "@/lib/match/round-completion";
import { setFlash } from "@/lib/flash";
import { publicTournamentPath } from "@/lib/tournament-path";
import { logAdminAction } from "@/lib/audit-log";
import { getActiveMatchForTable } from "@/lib/match/lookup";

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

  // The table's QR token is the only thing that ties a player to a match, so the result has
  // to be for the match that's on this table right now — not whatever match id a stale page
  // (round re-paired after a no-show) or a hand-crafted request happens to post.
  const active = await getActiveMatchForTable(qrToken);
  if ("error" in active || active.match.id !== matchId) {
    revalidatePath(`/table/${qrToken}`);
    return;
  }

  // Expected, not exceptional: a stale page (the match was already confirmed by the other
  // side, or turned out to be a Bye) still shows an active form. This used to throw, which
  // with no error boundary crashed the whole page ("This page couldn't load") instead of
  // just showing the now-current state — so resolveMatchSubmission returns it as a normal
  // outcome instead.
  const outcome = await resolveMatchSubmission(matchId, side, player1Score, player2Score);

  // Stale-page outcomes (not-found / already decided) and "waiting" need no alert — the
  // page re-renders into the current state, which already says what's going on.
  if (outcome.kind === "confirmed") {
    if (outcome.tournamentCompleted) revalidateTournamentStatus(outcome.tournamentCompleted);
    // A tie is rare enough in A-Math that a referee checks it at the table before anyone
    // moves on — hence the chime on top of the warning.
    await setFlash(
      player1Score === player2Score
        ? {
            type: "warning",
            title: "ผลเสมอ — เรียกกรรมการมาตรวจ",
            key: `match-${matchId}`,
            description: "กดปุ่ม “เรียกกรรมการ” ด้านล่าง แล้วรอกรรมการที่โต๊ะ",
            sound: true,
          }
        : {
            type: "success",
            title: "ยืนยันผลแล้ว",
            description: "ผลตรงกับที่คู่แข่งส่งไว้",
            key: `match-${matchId}`,
          }
    );
  } else if (outcome.kind === "conflict") {
    await setFlash({
      type: "warning",
      title: "ผลไม่ตรงกัน",
      key: `match-${matchId}`,
      description: "ตรวจสอบกับคู่แข่งอีกครั้ง แล้วแก้ผลที่ผิดให้ตรงกัน หรือกด “เรียกกรรมการ”",
    });
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
    include: {
      tournament: { select: { mode: true } },
      round: { select: { roundNumber: true } },
      table: { select: { tableNumber: true } },
      player1: { include: { globalPlayer: true } },
      player2: { include: { globalPlayer: true } },
    },
  });
  const admin = await assertTournamentAccess(match.tournamentId);
  if (match.isBye) {
    throw new Error("Match นี้เป็น Bye ไม่ต้องกรอกคะแนน");
  }

  const result = computeResult(player1Score, player2Score);
  // Result + round completion in one transaction, same as the players' dual-submission flow.
  const { tournamentCompleted } = await prisma.$transaction(async (tx) => {
    await tx.match.update({
      where: { id: matchId },
      data: {
        finalPlayer1Score: player1Score,
        finalPlayer2Score: player2Score,
        player1Result: result.player1Result,
        player2Result: result.player2Result,
        status: "CONFIRMED",
        editedByAdminId: admin.id,
        // A real result means both players were there — drop any "opponent didn't show" claim.
        byeClaimedById: null,
        byeClaimedAt: null,
      },
    });
    return match.roundId ? completeRoundIfDone(tx, match.roundId) : { tournamentCompleted: null };
  });
  if (tournamentCompleted) revalidateTournamentStatus(tournamentCompleted);
  if (match.roundId) {
    revalidatePath(`/admin/tournaments/${match.tournamentId}/rounds/${match.roundId}`);
  }

  const vsName = match.player2 ? `${match.player1.globalPlayer.name} vs ${match.player2.globalPlayer.name}` : match.player1.globalPlayer.name;
  await logAdminAction({
    actorId: admin.id,
    action: "match.admin_override",
    summary: `แก้ไขผล ${vsName} เป็น ${player1Score}-${player2Score}`,
    targetType: "Match",
    targetId: match.id,
  });

  // Says which game was saved — a round page lists every table, so "saved" alone isn't enough.
  const where = [
    match.round ? `Round ${match.round.roundNumber}` : "เกมฝึกซ้อม",
    match.table ? `Table ${match.table.tableNumber}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  await setFlash({
    type: "success",
    result: true,
    title: "บันทึกผลแล้ว",
    description: `${where} · ${match.player1.globalPlayer.name} ${player1Score} – ${player2Score} ${match.player2?.globalPlayer.name ?? ""}`.trim(),
  });
  revalidatePath(`/admin/tournaments/${match.tournamentId}/scoreboard`);
  revalidatePath("/admin/score-entry");
  revalidatePath(publicTournamentPath({ id: match.tournamentId, mode: match.tournament.mode }));
}

const tableByeSchema = z.object({
  matchId: z.string().min(1),
  qrToken: z.string().min(1),
  side: z.enum(["PLAYER1", "PLAYER2"]).optional(),
});

// Resolves the match a table-QR form posted about, or null when the page was stale (round
// moved on, match already decided) — same "expected, not exceptional" handling as above.
async function openTableMatch(qrToken: string, matchId: string) {
  const active = await getActiveMatchForTable(qrToken);
  if ("error" in active || active.match.id !== matchId) return null;
  const m = active.match;
  if (m.isBye || !m.player2Id || m.status === "CONFIRMED" || m.status === "BYE") return null;
  return m;
}

// Late-arrival Bye, player side: someone at the table reports that their opponent never
// showed up. Public like submitMatchResult (no account at the table) — which is exactly why
// this only records the claim; it counts once Admin/Staff approve it by marking the opponent
// absent, which re-pairs the round (repairRoundForAbsences).
export async function claimLateBye(formData: FormData) {
  const parsed = tableByeSchema.safeParse({
    matchId: formData.get("matchId"),
    qrToken: formData.get("qrToken"),
    side: formData.get("side"),
  });
  if (!parsed.success || !parsed.data.side) throw new Error("ข้อมูลไม่ครบ");
  const { matchId, qrToken, side } = parsed.data;

  const m = await openTableMatch(qrToken, matchId);
  if (m) {
    await prisma.match.update({
      where: { id: matchId },
      data: {
        byeClaimedById: side === "PLAYER1" ? m.player1Id : m.player2Id,
        byeClaimedAt: new Date(),
      },
    });
    await setFlash({ type: "info", title: "แจ้งแล้ว", description: "รอ Admin/Staff ยืนยันและจัดคู่ใหม่" });
    if (m.roundId) revalidatePath(`/admin/tournaments/${m.tournamentId}/rounds/${m.roundId}`);
  }
  revalidatePath(`/table/${qrToken}`);
}

// The opponent turned up after all — anyone at the table can withdraw the pending claim.
export async function cancelLateByeClaim(formData: FormData) {
  const parsed = tableByeSchema.safeParse({
    matchId: formData.get("matchId"),
    qrToken: formData.get("qrToken"),
  });
  if (!parsed.success) throw new Error("ข้อมูลไม่ครบ");
  const { matchId, qrToken } = parsed.data;

  const m = await openTableMatch(qrToken, matchId);
  if (m) {
    await prisma.match.update({
      where: { id: matchId },
      data: { byeClaimedById: null, byeClaimedAt: null },
    });
    if (m.roundId) revalidatePath(`/admin/tournaments/${m.tournamentId}/rounds/${m.roundId}`);
  }
  revalidatePath(`/table/${qrToken}`);
}

// Admin/Staff turn down a player's "opponent didn't show" claim (e.g. the opponent is here).
export async function adminRejectByeClaim(formData: FormData) {
  const matchId = String(formData.get("matchId") ?? "");
  const match = await prisma.match.findUniqueOrThrow({ where: { id: matchId } });
  await assertTournamentAccess(match.tournamentId);

  await prisma.match.update({
    where: { id: matchId },
    data: { byeClaimedById: null, byeClaimedAt: null },
  });
  if (match.roundId) revalidatePath(`/admin/tournaments/${match.tournamentId}/rounds/${match.roundId}`);
}
