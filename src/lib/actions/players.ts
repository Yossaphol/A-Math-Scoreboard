"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertTournamentAccess } from "@/lib/dal";
import { setFlash } from "@/lib/flash";
import { ensureTableCount } from "@/lib/tables";
import { generateGlobalPlayerId } from "@/lib/global-player-id";
import { parsePlayerImportFile, PlayerImportError } from "@/lib/players/import";

const addPlayerSchema = z.object({
  tournamentId: z.string().min(1),
  globalPlayerId: z.coerce.number().int().positive().optional(),
  name: z.string().trim().min(1).optional(),
  nickname: z.string().trim().optional(),
});

export type GlobalPlayerSearchResult = {
  id: number;
  name: string;
  nickname: string | null;
  inTournament: boolean;
};

// Backs the live search in the "add player" modal on the tournament Players tab — finds
// existing Global Players (by name, nickname or exact Global Player ID) to reuse.
export async function searchGlobalPlayersForTournament(
  tournamentId: string,
  query: string
): Promise<GlobalPlayerSearchResult[]> {
  await assertTournamentAccess(tournamentId);
  const q = query.trim();
  if (!q) return [];

  const asId = Number(q);
  const [results, inTournament] = await Promise.all([
    prisma.globalPlayer.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { nickname: { contains: q, mode: "insensitive" } },
          ...(Number.isInteger(asId) && asId > 0 ? [{ id: asId }] : []),
        ],
      },
      take: 10,
      orderBy: { name: "asc" },
    }),
    prisma.tournamentPlayer.findMany({ where: { tournamentId }, select: { globalPlayerId: true } }),
  ]);
  const already = new Set(inTournament.map((p) => p.globalPlayerId));
  return results.map((gp) => ({
    id: gp.id,
    name: gp.name,
    nickname: gp.nickname,
    inTournament: already.has(gp.id),
  }));
}

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

  // Deleting a player who has played would also have to delete those Matches, rewriting their
  // opponents' results and the standings — so once there's any history, only Withdraw is allowed.
  const [matchCount, absenceCount] = await Promise.all([
    prisma.match.count({
      where: { OR: [{ player1Id: tournamentPlayerId }, { player2Id: tournamentPlayerId }] },
    }),
    prisma.roundAbsence.count({ where: { tournamentPlayerId } }),
  ]);
  if (matchCount + absenceCount > 0) {
    throw new Error("ผู้เล่นนี้มีประวัติการแข่งแล้ว ลบไม่ได้ ใช้ถอนตัวแทน");
  }

  await prisma.tournamentPlayer.delete({ where: { id: tournamentPlayerId } });
  await setFlash("ลบผู้เล่นออกจากการแข่งขันแล้ว");
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
  await setFlash("ถอนตัวผู้เล่นแล้ว");
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

// Bulk import from a .csv/.xlsx/.json roster. Every row is checked against existing Global
// Players first (by globalPlayerId if given, else exact case-insensitive name match) — an
// existing player is always reused, never duplicated, matching the same rule single-add
// already follows. A row already in THIS tournament is skipped, not re-added. Bad rows are
// recorded and skipped individually rather than failing the whole import.
export async function importPlayersToTournament(formData: FormData) {
  const tournamentId = String(formData.get("tournamentId"));
  if (!tournamentId) throw new Error("ไม่พบ Tournament");
  await assertTournamentAccess(tournamentId);

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("กรุณาเลือกไฟล์ .csv, .xlsx หรือ .json");
  }

  let rows;
  try {
    rows = await parsePlayerImportFile(file);
  } catch (e) {
    if (e instanceof PlayerImportError) throw e;
    throw new Error("อ่านไฟล์ไม่สำเร็จ — ตรวจสอบรูปแบบไฟล์อีกครั้ง");
  }

  const summary = { addedNew: 0, addedExisting: 0, skippedDuplicate: 0, errors: [] as string[] };

  await prisma.$transaction(async (tx) => {
    const last = await tx.tournamentPlayer.findFirst({
      where: { tournamentId },
      orderBy: { tournamentPlayerNo: "desc" },
    });
    let nextNo = (last?.tournamentPlayerNo ?? 0) + 1;

    for (const [index, row] of rows.entries()) {
      try {
        let globalPlayerId: number;
        let isNewGlobalPlayer = false;

        if (row.globalPlayerId != null) {
          const existing = await tx.globalPlayer.findUnique({ where: { id: row.globalPlayerId } });
          if (!existing) {
            summary.errors.push(`แถว ${index + 1}: ไม่พบ Global Player ID ${row.globalPlayerId}`);
            continue;
          }
          globalPlayerId = existing.id;
        } else if (row.name) {
          const existing = await tx.globalPlayer.findFirst({
            where: { name: { equals: row.name, mode: "insensitive" } },
          });
          if (existing) {
            globalPlayerId = existing.id;
          } else {
            const id = await generateGlobalPlayerId(tx);
            const created = await tx.globalPlayer.create({
              data: { id, name: row.name, nickname: row.nickname || null },
            });
            globalPlayerId = created.id;
            isNewGlobalPlayer = true;
          }
        } else {
          summary.errors.push(`แถว ${index + 1}: ไม่มีชื่อหรือ Global Player ID`);
          continue;
        }

        const already = await tx.tournamentPlayer.findUnique({
          where: { tournamentId_globalPlayerId: { tournamentId, globalPlayerId } },
        });
        if (already) {
          summary.skippedDuplicate += 1;
          continue;
        }

        await tx.tournamentPlayer.create({
          data: { tournamentId, globalPlayerId, tournamentPlayerNo: nextNo, status: "ACTIVE" },
        });
        nextNo += 1;
        if (isNewGlobalPlayer) summary.addedNew += 1;
        else summary.addedExisting += 1;
      } catch (e) {
        summary.errors.push(`แถว ${index + 1}: ${e instanceof Error ? e.message : "เกิดข้อผิดพลาด"}`);
      }
    }

    await ensureTableCount(tx, tournamentId);
  });

  const parts = [`เพิ่มใหม่ ${summary.addedNew} คน`, `ใช้ผู้เล่นเดิม ${summary.addedExisting} คน`];
  if (summary.skippedDuplicate > 0) {
    parts.push(`ข้าม ${summary.skippedDuplicate} คน (มีอยู่ใน Tournament นี้แล้ว)`);
  }
  if (summary.errors.length > 0) {
    parts.push(
      `ผิดพลาด ${summary.errors.length} แถว: ${summary.errors.slice(0, 3).join("; ")}${
        summary.errors.length > 3 ? " ..." : ""
      }`
    );
  }
  await setFlash(`นำเข้าผู้เล่นเสร็จสิ้น — ${parts.join(", ")}`, summary.errors.length > 0 ? "error" : "success");
  revalidatePath(`/admin/tournaments/${tournamentId}/players`);
}
