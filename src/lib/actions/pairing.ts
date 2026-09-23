"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertTournamentAccess } from "@/lib/dal";
import { generatePairing } from "@/lib/pairing/generate";
import { matchStarted, planAbsenceRepair } from "@/lib/pairing/absence-repair";
import { getFirstSecondTotals, assignFirstSecond } from "@/lib/pairing/first-second";
import { maybeCompleteRound } from "@/lib/match/round-completion";
import { setFlash } from "@/lib/flash";
import { publicTournamentPath } from "@/lib/tournament-path";
import { logAdminAction } from "@/lib/audit-log";
import type { PairingMethod } from "@/generated/prisma/enums";

const startPairingSchema = z.object({
  tournamentId: z.string().min(1),
  pairingMethod: z.enum(["RANDOM", "SWISS", "KING_OF_THE_HILL", "ROUND_ROBIN"]),
  maximumScore: z.coerce.number().int().positive().optional(),
});

// Spec §9/§10/§11: Generate Pairing → Preview, before anything is confirmed.
export async function startPairing(formData: FormData) {
  const maximumScoreEnabled = formData.get("maximumScoreEnabled") === "on";

  const parsed = startPairingSchema.safeParse({
    tournamentId: formData.get("tournamentId"),
    pairingMethod: formData.get("pairingMethod"),
    maximumScore: formData.get("maximumScore") || undefined,
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((i) => i.message).join(", "));
  }
  const { tournamentId, pairingMethod, maximumScore } = parsed.data;
  await assertTournamentAccess(tournamentId);

  const tournament = await prisma.tournament.findUniqueOrThrow({ where: { id: tournamentId } });

  // Only one Round may be in progress at a time — this is also what keeps the Table QR
  // lookup (spec §12) unambiguous about which round is "current".
  const existingInProgress = await prisma.round.findFirst({
    where: { tournamentId, status: { in: ["DRAFT", "PREVIEW", "CONFIRMED"] } },
  });
  if (existingInProgress) {
    throw new Error(
      existingInProgress.status === "CONFIRMED"
        ? `Round ${existingInProgress.roundNumber} ยังเล่นไม่จบ — ต้องให้ทุก Match ยืนยันผลก่อนเปิด Round ถัดไป`
        : `มี Round ${existingInProgress.roundNumber} ที่ยังไม่ Confirm อยู่แล้ว — Confirm หรือยกเลิกก่อน`
    );
  }

  const lastRound = await prisma.round.findFirst({
    where: { tournamentId },
    orderBy: { roundNumber: "desc" },
  });
  const roundNumber = (lastRound?.roundNumber ?? 0) + 1;

  // Practice-mode only: staff can pick a subset of the active roster to play this round
  // (spec §7 — not everyone has to play every round). A COMPETITION tournament's form never
  // renders the checkbox list, so rawPlayerIds is always empty there.
  const rawPlayerIds = formData.getAll("playerIds").map(String).filter(Boolean);
  const participantIds =
    tournament.mode === "PRACTICE" && rawPlayerIds.length > 0 ? new Set(rawPlayerIds) : undefined;

  const pairs = await generatePairing(
    tournamentId,
    roundNumber,
    pairingMethod as PairingMethod,
    participantIds
  );
  if (pairs.length === 0) {
    throw new Error("ไม่มีผู้เล่น Active ให้จับคู่");
  }

  const tables = await prisma.tournamentTable.findMany({
    where: { tournamentId },
    orderBy: { tableNumber: "asc" },
  });

  const totals = tournament.useFirstSecond
    ? await getFirstSecondTotals(tournamentId)
    : new Map<string, number>();

  let tableCursor = 0;
  const matchData = pairs.map((pair) => {
    const isBye = pair.player2Id == null;
    const table = !isBye && tables.length > 0 ? tables[tableCursor++ % tables.length] : undefined;

    const firstSecond =
      !isBye && tournament.useFirstSecond
        ? assignFirstSecond(pair.player1Id, pair.player2Id!, totals)
        : { firstPlayerId: null, secondPlayerId: null };

    return {
      roundId: "", // filled in after round is created
      tournamentId,
      tableId: table?.id ?? null,
      player1Id: pair.player1Id,
      player2Id: pair.player2Id,
      isBye,
      firstPlayerId: firstSecond.firstPlayerId,
      secondPlayerId: firstSecond.secondPlayerId,
      status: "PENDING" as const,
    };
  });

  await prisma.$transaction(async (tx) => {
    const round = await tx.round.create({
      data: {
        tournamentId,
        roundNumber,
        pairingMethod: pairingMethod as PairingMethod,
        status: "PREVIEW",
        maximumScoreEnabled,
        maximumScore: maximumScoreEnabled ? maximumScore ?? tournament.defaultMaximumScore : null,
      },
    });

    await tx.match.createMany({
      data: matchData.map((m) => ({ ...m, roundId: round.id })),
    });
  });

  await setFlash(`สร้าง Pairing Round ${roundNumber} แล้ว — ตรวจสอบก่อน Confirm`);
  revalidatePath(`/admin/tournaments/${tournamentId}`);
  revalidatePath(`/admin/tournaments/${tournamentId}/rounds`);
}

// Swap two players wherever they currently sit in the Preview round (stands in for
// drag & drop for now — spec §10 only requires that pairing can be adjusted before Confirm,
// not a specific interaction).
export async function swapPreviewPlayers(formData: FormData) {
  const roundId = String(formData.get("roundId"));
  const playerAId = String(formData.get("playerAId"));
  const playerBId = String(formData.get("playerBId"));
  if (playerAId === playerBId) return;

  const round = await prisma.round.findUniqueOrThrow({
    where: { id: roundId },
    include: { tournament: true },
  });
  await assertTournamentAccess(round.tournamentId);
  // After Confirm, still allowed for matches nobody has started yet — e.g. to adjust the
  // automatic re-pairing done around no-shows (repairRoundForAbsences).
  if (round.status !== "PREVIEW" && round.status !== "CONFIRMED") {
    throw new Error("แก้ไข Pairing ได้เฉพาะ Round ที่ยังแข่งไม่จบ");
  }

  const matches = await prisma.match.findMany({ where: { roundId }, include: { submissions: true } });
  const matchA = matches.find((m) => m.player1Id === playerAId || m.player2Id === playerAId);
  const matchB = matches.find((m) => m.player1Id === playerBId || m.player2Id === playerBId);
  if (!matchA || !matchB) {
    throw new Error("ไม่พบผู้เล่นที่จะสลับใน Round นี้");
  }
  // Both already seated in the same match — swapping sides changes nothing, so no-op instead
  // of erroring (a drag/tap that lands back in its own match is a common, harmless mis-drop).
  if (matchA.id === matchB.id) return;
  const started = (m: typeof matchA) => matchStarted({ status: m.status, submissionCount: m.submissions.length });
  if (started(matchA) || started(matchB)) {
    throw new Error("สลับไม่ได้ — แมตช์นี้มีการส่งผลแล้ว");
  }

  const aIsPlayer1 = matchA.player1Id === playerAId;
  const bIsPlayer1 = matchB.player1Id === playerBId;

  await prisma.$transaction(async (tx) => {
    // New opponents — any "opponent didn't show" report was about the old pairing.
    await tx.match.update({
      where: { id: matchA.id },
      data: {
        ...(aIsPlayer1 ? { player1Id: playerBId } : { player2Id: playerBId }),
        byeClaimedById: null,
        byeClaimedAt: null,
      },
    });
    await tx.match.update({
      where: { id: matchB.id },
      data: {
        ...(bIsPlayer1 ? { player1Id: playerAId } : { player2Id: playerAId }),
        byeClaimedById: null,
        byeClaimedAt: null,
      },
    });
  });

  if (round.tournament.useFirstSecond) {
    const totals = await getFirstSecondTotals(round.tournamentId);
    for (const matchId of [matchA.id, matchB.id]) {
      const fresh = await prisma.match.findUniqueOrThrow({ where: { id: matchId } });
      if (fresh.player2Id) {
        const fs = assignFirstSecond(fresh.player1Id, fresh.player2Id, totals);
        await prisma.match.update({ where: { id: matchId }, data: fs });
      }
    }
  }

  revalidatePath(`/admin/tournaments/${round.tournamentId}`);
  revalidatePath(`/admin/tournaments/${round.tournamentId}/rounds`);
  revalidatePath(`/admin/tournaments/${round.tournamentId}/rounds/${round.id}`);
}

export async function confirmPairing(formData: FormData) {
  const roundId = String(formData.get("roundId"));
  const round = await prisma.round.findUniqueOrThrow({
    where: { id: roundId },
    include: { tournament: { select: { mode: true } } },
  });
  await assertTournamentAccess(round.tournamentId);
  if (round.status !== "PREVIEW") {
    throw new Error("Round นี้ไม่ได้อยู่ในสถานะ Preview");
  }

  await prisma.$transaction([
    prisma.round.update({
      where: { id: roundId },
      data: { status: "CONFIRMED", confirmedAt: new Date() },
    }),
    // Bye matches need no submission (spec §19: W=2, Diff +100) — finalize them immediately.
    prisma.match.updateMany({
      where: { roundId, isBye: true },
      data: { status: "BYE" },
    }),
  ]);

  await maybeCompleteRound(roundId);

  await setFlash(`Confirm Round ${round.roundNumber} แล้ว`);
  revalidatePath(`/admin/tournaments/${round.tournamentId}`);
  revalidatePath(`/admin/tournaments/${round.tournamentId}/rounds`);
  revalidatePath(publicTournamentPath({ id: round.tournamentId, mode: round.tournament.mode }));
}

export async function cancelPreview(formData: FormData) {
  const roundId = String(formData.get("roundId"));
  const round = await prisma.round.findUniqueOrThrow({ where: { id: roundId } });
  await assertTournamentAccess(round.tournamentId);
  if (round.status !== "PREVIEW") {
    throw new Error("Round นี้ไม่ได้อยู่ในสถานะ Preview");
  }

  await prisma.round.delete({ where: { id: roundId } });
  await setFlash("ยกเลิก Pairing Preview แล้ว");
  revalidatePath(`/admin/tournaments/${round.tournamentId}`);
  revalidatePath(`/admin/tournaments/${round.tournamentId}/rounds`);
}

// Lets Admin/Staff undo a round created by mistake — deliberately restricted to the LATEST
// round only (any status: Preview/Confirmed/Completed), never a round in the middle, since
// deleting one there would leave a gap in roundNumber and desync every later round's pairing
// (Swiss score groups, standings) from what actually happened. Deleting cascades to that
// round's Matches/MatchSubmissions (schema onDelete: Cascade) — any scores already recorded
// for it are gone for good, so this is one of the actions written to the Audit Log.
export async function deleteRound(formData: FormData) {
  const roundId = String(formData.get("roundId"));
  const round = await prisma.round.findUniqueOrThrow({
    where: { id: roundId },
    include: { tournament: { select: { mode: true } } },
  });
  const admin = await assertTournamentAccess(round.tournamentId);

  const latest = await prisma.round.findFirst({
    where: { tournamentId: round.tournamentId },
    orderBy: { roundNumber: "desc" },
  });
  if (latest?.id !== roundId) {
    throw new Error("ลบได้เฉพาะ Round ล่าสุดเท่านั้น — ต้องลบ Round ที่สร้างหลังจากนี้ก่อน");
  }

  await prisma.round.delete({ where: { id: roundId } });

  await logAdminAction({
    actorId: admin.id,
    action: "round.delete",
    summary: `ลบ Round ${round.roundNumber} (สถานะตอนลบ: ${round.status})`,
    targetType: "Round",
    targetId: round.id,
  });

  await setFlash(`ลบ Round ${round.roundNumber} แล้ว`);
  revalidatePath(`/admin/tournaments/${round.tournamentId}`);
  revalidatePath(`/admin/tournaments/${round.tournamentId}/rounds`);
  revalidatePath(publicTournamentPath({ id: round.tournamentId, mode: round.tournament.mode }));
  redirect(`/admin/tournaments/${round.tournamentId}/rounds`);
}

/**
 * No-shows: sets the complete list of players absent from a Round (checked by Admin/Staff at
 * the start of the round, or approved from a player's "opponent didn't show" report) and
 * re-pairs around them — instead of handing every abandoned player a Bye.
 *
 * - Matches with both players present are left exactly as they are.
 * - Players whose opponent is absent (and any Bye recipient) are re-paired among themselves
 *   with the Round's own pairing method, on the standings from before this Round, reusing the
 *   freed tables. Only an odd one out gets a Bye (W 100-0).
 * - Each absent player gets a forfeit: L 0-100 (Diff -100) via RoundAbsence.
 * - Unchecking someone (they arrived) puts them back into that re-pairing pool.
 *
 * Works in PREVIEW and CONFIRMED, but never touches a match that has already started.
 */
export async function repairRoundForAbsences(formData: FormData) {
  const roundId = String(formData.get("roundId") ?? "");
  const absentIds = new Set(formData.getAll("absentPlayerIds").map(String).filter(Boolean));

  const round = await prisma.round.findUniqueOrThrow({
    where: { id: roundId },
    include: {
      tournament: true,
      matches: { include: { submissions: true } },
      absences: true,
    },
  });
  const admin = await assertTournamentAccess(round.tournamentId);
  if (round.status !== "PREVIEW" && round.status !== "CONFIRMED") {
    throw new Error("จัดคู่ใหม่ได้เฉพาะ Round ที่ยังแข่งไม่จบ");
  }

  const previouslyAbsent = new Set(round.absences.map((a) => a.tournamentPlayerId));
  const plan = planAbsenceRepair(
    round.matches.map((m) => ({ ...m, submissionCount: m.submissions.length })),
    previouslyAbsent,
    absentIds
  );
  if (!plan.ok && plan.error === "not-in-round") {
    throw new Error("ผู้เล่นที่เลือกไม่ได้อยู่ใน Round นี้");
  }

  const players = await prisma.tournamentPlayer.findMany({
    where: { id: { in: [...previouslyAbsent, ...round.matches.flatMap((m) => [m.player1Id, m.player2Id ?? ""])] } },
    include: { globalPlayer: true },
  });
  const nameOf = new Map(players.map((p) => [p.id, p.globalPlayer.name]));

  if (!plan.ok) {
    throw new Error(
      `${plan.playerIds.map((id) => nameOf.get(id)).join(", ")} มีการส่งผลในแมตช์นี้แล้ว — ทำเครื่องหมายว่าไม่มาไม่ได้`
    );
  }
  const { kept, dissolved, toPair } = plan;

  const absencesUnchanged =
    previouslyAbsent.size === absentIds.size && [...absentIds].every((id) => previouslyAbsent.has(id));
  // Same list as last time — everything around it was already re-paired then.
  if (absencesUnchanged) {
    await setFlash("ไม่มีอะไรเปลี่ยน");
    return;
  }

  const pairs =
    toPair.length > 0
      ? await generatePairing(
          round.tournamentId,
          round.roundNumber,
          round.pairingMethod ?? "RANDOM",
          new Set(toPair),
          { excludeRoundId: round.id }
        )
      : [];
  // generatePairing only pools ACTIVE players — refuse rather than silently drop anyone.
  const paired = new Set(pairs.flatMap((p) => [p.player1Id, p.player2Id].filter((id): id is string => !!id)));
  const unpaired = toPair.filter((id) => !paired.has(id));
  if (unpaired.length > 0) {
    throw new Error(
      `จับคู่ ${unpaired.map((id) => nameOf.get(id)).join(", ")} ไม่ได้ (อาจถูก Withdraw) — ทำเครื่องหมายว่าไม่มา หรือ Reactivate ก่อน`
    );
  }

  // Seat new games at the tables just freed first, then any other table unused this Round.
  const tables = await prisma.tournamentTable.findMany({
    where: { tournamentId: round.tournamentId },
    orderBy: { tableNumber: "asc" },
  });
  const usedTableIds = new Set(kept.map((m) => m.tableId).filter((id): id is string => !!id));
  const freeTableIds = [
    ...new Set([
      ...dissolved.map((m) => m.tableId).filter((id): id is string => !!id && !usedTableIds.has(id)),
      ...tables.map((t) => t.id).filter((id) => !usedTableIds.has(id)),
    ]),
  ];

  const totals = round.tournament.useFirstSecond
    ? await getFirstSecondTotals(round.tournamentId)
    : new Map<string, number>();
  let tableCursor = 0;
  const newMatches = pairs.map((pair) => {
    const isBye = pair.player2Id == null;
    const firstSecond =
      !isBye && round.tournament.useFirstSecond
        ? assignFirstSecond(pair.player1Id, pair.player2Id!, totals)
        : { firstPlayerId: null, secondPlayerId: null };
    return {
      roundId: round.id,
      tournamentId: round.tournamentId,
      tableId: isBye ? null : (freeTableIds[tableCursor++] ?? null),
      player1Id: pair.player1Id,
      player2Id: pair.player2Id,
      isBye,
      firstPlayerId: firstSecond.firstPlayerId,
      secondPlayerId: firstSecond.secondPlayerId,
      // confirmPairing finalizes Byes on Confirm; in an already-confirmed Round do it here.
      status: isBye && round.status === "CONFIRMED" ? ("BYE" as const) : ("PENDING" as const),
    };
  });

  await prisma.$transaction(async (tx) => {
    // Re-checked inside the transaction: a player could have just submitted a score.
    const deleted = await tx.match.deleteMany({
      where: {
        id: { in: dissolved.map((m) => m.id) },
        submissions: { none: {} },
        status: { in: ["PENDING", "BYE"] },
      },
    });
    if (deleted.count !== dissolved.length) {
      throw new Error("มีผู้เล่นเพิ่งส่งผลเข้ามา — โหลดหน้าใหม่แล้วลองอีกครั้ง");
    }
    if (newMatches.length > 0) await tx.match.createMany({ data: newMatches });
    await tx.roundAbsence.deleteMany({
      where: { roundId: round.id, tournamentPlayerId: { notIn: [...absentIds] } },
    });
    if (absentIds.size > 0) {
      await tx.roundAbsence.createMany({
        data: [...absentIds].map((id) => ({
          roundId: round.id,
          tournamentId: round.tournamentId,
          tournamentPlayerId: id,
        })),
        skipDuplicates: true,
      });
    }
  });

  if (round.status === "CONFIRMED") await maybeCompleteRound(round.id);

  const absentNames = [...absentIds].map((id) => nameOf.get(id)).join(", ") || "—";
  const pairText =
    pairs
      .map((p) => (p.player2Id ? `${nameOf.get(p.player1Id)} vs ${nameOf.get(p.player2Id)}` : `${nameOf.get(p.player1Id)} (Bye)`))
      .join(", ") || "—";
  await logAdminAction({
    actorId: admin.id,
    action: "round.absence_repair",
    summary: `Round ${round.roundNumber}: ไม่มา ${absentNames} · จับคู่ใหม่ ${pairText}`,
    targetType: "Round",
    targetId: round.id,
  });

  const byeCount = pairs.filter((p) => !p.player2Id).length;
  await setFlash(
    `จัดคู่ใหม่แล้ว — ไม่มา ${absentIds.size} คน, จับคู่ใหม่ ${pairs.length - byeCount} คู่${byeCount ? `, Bye ${byeCount} คน` : ""}`
  );
  revalidatePath(`/admin/tournaments/${round.tournamentId}`);
  revalidatePath(`/admin/tournaments/${round.tournamentId}/rounds`);
  revalidatePath(`/admin/tournaments/${round.tournamentId}/rounds/${round.id}`);
  revalidatePath(publicTournamentPath({ id: round.tournamentId, mode: round.tournament.mode }));
}
