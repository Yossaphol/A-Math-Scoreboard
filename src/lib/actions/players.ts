"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertTournamentAccess } from "@/lib/dal";
import { setFlash } from "@/lib/flash";
import { ensureTableCount } from "@/lib/tables";
import { generateGlobalPlayerId } from "@/lib/global-player-id";

const addPlayerSchema = z.object({
  tournamentId: z.string().min(1),
  globalPlayerId: z.coerce.number().int().positive().optional(),
  name: z.string().trim().min(1).optional(),
  nickname: z.string().trim().optional(),
});

// Spec §1: Admin/Staff manage players directly — no self-signup. New players get the next
// sequential Tournament Player ID (per-tournament, starting at 1); existing Global Players
// can be reused across tournaments while keeping the same Global Player ID.
export async function addPlayerToTournament(formData: FormData) {
  const parsed = addPlayerSchema.safeParse({
    tournamentId: formData.get("tournamentId"),
    globalPlayerId: formData.get("globalPlayerId") || undefined,
    name: formData.get("name") || undefined,
    nickname: formData.get("nickname") || undefined,
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((i) => i.message).join(", "));
  }
  const { tournamentId, globalPlayerId, name, nickname } = parsed.data;
  await assertTournamentAccess(tournamentId);

  if (!globalPlayerId && !name) {
    throw new Error("ต้องเลือกผู้เล่นที่มีอยู่ หรือกรอกชื่อผู้เล่นใหม่");
  }

  await prisma.$transaction(async (tx) => {
    let resolvedGlobalPlayerId = globalPlayerId;

    if (!resolvedGlobalPlayerId) {
      const created = await tx.globalPlayer.create({
        data: { id: await generateGlobalPlayerId(tx), name: name!, nickname: nickname || null },
      });
      resolvedGlobalPlayerId = created.id;
    }

    const existing = await tx.tournamentPlayer.findUnique({
      where: {
        tournamentId_globalPlayerId: {
          tournamentId,
          globalPlayerId: resolvedGlobalPlayerId,
        },
      },
    });
    if (existing) {
      throw new Error("ผู้เล่นนี้อยู่ใน Tournament นี้แล้ว");
    }

    const last = await tx.tournamentPlayer.findFirst({
      where: { tournamentId },
      orderBy: { tournamentPlayerNo: "desc" },
    });
    const nextNo = (last?.tournamentPlayerNo ?? 0) + 1;

    await tx.tournamentPlayer.create({
      data: {
        tournamentId,
        globalPlayerId: resolvedGlobalPlayerId,
        tournamentPlayerNo: nextNo,
        status: "ACTIVE",
      },
    });

    // Keep Tables at ceil(playerCount / 2) — spec §12's one-QR-per-table only works if
    // there's always enough tables for every concurrent match.
    await ensureTableCount(tx, tournamentId);
  });

  await setFlash("เพิ่มผู้เล่นแล้ว");
  revalidatePath(`/admin/tournaments/${tournamentId}/players`);
}

// Spec §15: removing a player is only for before the tournament starts (e.g. wrong import).
export async function removePlayerFromTournament(formData: FormData) {
  const tournamentPlayerId = String(formData.get("tournamentPlayerId"));
  const tp = await prisma.tournamentPlayer.findUniqueOrThrow({
    where: { id: tournamentPlayerId },
    include: { tournament: true },
  });
  await assertTournamentAccess(tp.tournamentId);

  if (tp.tournament.status !== "UPCOMING") {
    throw new Error("ลบผู้เล่นได้เฉพาะก่อน Tournament เริ่มเท่านั้น ใช้ Withdraw แทน");
  }

  await prisma.tournamentPlayer.delete({ where: { id: tournamentPlayerId } });
  await setFlash("ลบผู้เล่นแล้ว");
  revalidatePath(`/admin/tournaments/${tp.tournamentId}/players`);
}

// Spec §15/§19: Withdraw ≠ Delete — history and stats before withdrawal stay intact.
export async function withdrawPlayer(formData: FormData) {
  const tournamentPlayerId = String(formData.get("tournamentPlayerId"));
  const tp = await prisma.tournamentPlayer.findUniqueOrThrow({
    where: { id: tournamentPlayerId },
  });
  await assertTournamentAccess(tp.tournamentId);

  await prisma.tournamentPlayer.update({
    where: { id: tournamentPlayerId },
    data: { status: "WITHDRAWN" },
  });
  await setFlash("Withdraw ผู้เล่นแล้ว");
  revalidatePath(`/admin/tournaments/${tp.tournamentId}/players`);
}

export async function reactivatePlayer(formData: FormData) {
  const tournamentPlayerId = String(formData.get("tournamentPlayerId"));
  const tp = await prisma.tournamentPlayer.findUniqueOrThrow({
    where: { id: tournamentPlayerId },
  });
  await assertTournamentAccess(tp.tournamentId);

  await prisma.tournamentPlayer.update({
    where: { id: tournamentPlayerId },
    data: { status: "ACTIVE" },
  });
  revalidatePath(`/admin/tournaments/${tp.tournamentId}/players`);
}
