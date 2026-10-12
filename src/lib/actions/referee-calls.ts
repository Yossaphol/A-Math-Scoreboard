"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertTournamentAccess } from "@/lib/dal";
import { getActiveMatchForTable, getLastFinishedMatchForTable } from "@/lib/match/lookup";
import { OPEN_REFEREE_CALL_STATUSES } from "@/lib/referee-calls";

const tableSchema = z.object({ qrToken: z.string().min(1) });

// Public, like the rest of /table — the QR token is the only thing tying a phone to a table.
// At most one open call per table, so repeat taps (or both players pressing) don't pile up.
export async function callReferee(formData: FormData) {
  const parsed = tableSchema.safeParse({ qrToken: formData.get("qrToken") });
  if (!parsed.success) throw new Error("ข้อมูลไม่ครบ");
  const { qrToken } = parsed.data;

  const table = await prisma.tournamentTable.findUnique({ where: { qrToken } });
  if (!table) throw new Error("ไม่พบโต๊ะนี้");

  // The match on the table right now, or — right after the last result of a round was
  // confirmed (e.g. a tie) — the one it just finished, so the referee knows what to check.
  const active = await getActiveMatchForTable(qrToken);
  const matchId =
    "error" in active ? ((await getLastFinishedMatchForTable(qrToken))?.match.id ?? null) : active.match.id;

  await prisma.$transaction(async (tx) => {
    // Both players often tap at once — lock the table row so only one of them creates a call.
    await tx.$queryRaw`SELECT id FROM "TournamentTable" WHERE id = ${table.id} FOR UPDATE`;
    const existing = await tx.refereeCall.findFirst({
      where: { tableId: table.id, status: { in: OPEN_REFEREE_CALL_STATUSES } },
    });
    if (!existing) {
      await tx.refereeCall.create({ data: { tournamentId: table.tournamentId, tableId: table.id, matchId } });
    }
  });
  revalidatePath(`/table/${qrToken}`);
}

const cancelSchema = tableSchema.extend({ callId: z.string().min(1) });

// Anyone at the table can withdraw a call nobody has come for yet (or the referee's on the
// way but it sorted itself out).
export async function cancelRefereeCall(formData: FormData) {
  const parsed = cancelSchema.safeParse({ qrToken: formData.get("qrToken"), callId: formData.get("callId") });
  if (!parsed.success) throw new Error("ข้อมูลไม่ครบ");
  const { qrToken, callId } = parsed.data;

  await prisma.refereeCall.updateMany({
    where: { id: callId, table: { qrToken }, status: { in: OPEN_REFEREE_CALL_STATUSES } },
    data: { status: "CANCELLED", closedAt: new Date() },
  });
  revalidatePath(`/table/${qrToken}`);
}

async function loadCallForReferee(callId: string) {
  const call = await prisma.refereeCall.findUniqueOrThrow({
    where: { id: callId },
    include: { table: { select: { qrToken: true } } },
  });
  const user = await assertTournamentAccess(call.tournamentId);
  return { call, user };
}

/** "I'm on my way" — the table sees it, and other referees' screens stop ringing. */
export async function acknowledgeRefereeCall(callId: string) {
  const { call, user } = await loadCallForReferee(callId);
  await prisma.refereeCall.updateMany({
    where: { id: call.id, status: "OPEN" },
    data: { status: "ACKNOWLEDGED", handledById: user.id, acknowledgedAt: new Date() },
  });
  revalidatePath(`/table/${call.table.qrToken}`);
}

export async function resolveRefereeCall(callId: string) {
  const { call, user } = await loadCallForReferee(callId);
  await prisma.refereeCall.updateMany({
    where: { id: call.id, status: { in: OPEN_REFEREE_CALL_STATUSES } },
    data: { status: "RESOLVED", handledById: call.handledById ?? user.id, closedAt: new Date() },
  });
  revalidatePath(`/table/${call.table.qrToken}`);
}
