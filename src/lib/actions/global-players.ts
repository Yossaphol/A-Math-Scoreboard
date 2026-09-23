"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertAdmin } from "@/lib/dal";
import { setFlash } from "@/lib/flash";
import { generateGlobalPlayerId } from "@/lib/global-player-id";
import { publicTournamentPath } from "@/lib/tournament-path";
import { logAdminAction } from "@/lib/audit-log";

const createSchema = z.object({
  name: z.string().trim().min(1, "กรุณากรอกชื่อ"),
  nickname: z.string().trim().optional(),
});

// Creates a Player not tied to any Tournament yet — the same identity addPlayerToTournament
// creates on the fly when given a name instead of an existing globalPlayerId, just reachable
// directly from Global Players instead of only via a Tournament's player list.
export async function createGlobalPlayer(formData: FormData) {
  await assertAdmin();
  const parsed = createSchema.safeParse({
    name: formData.get("name"),
    nickname: formData.get("nickname") || undefined,
  });
  if (!parsed.success) throw new Error(parsed.error.issues.map((i) => i.message).join(", "));

  await prisma.$transaction(async (tx) => {
    const id = await generateGlobalPlayerId(tx);
    await tx.globalPlayer.create({
      data: { id, name: parsed.data.name, nickname: parsed.data.nickname || null },
    });
  });

  await setFlash("เพิ่มผู้เล่นแล้ว");
  revalidatePath("/admin/players");
}

const renameSchema = z.object({
  globalPlayerId: z.coerce.number().int().positive(),
  name: z.string().trim().min(1, "กรุณากรอกชื่อ"),
  nickname: z.string().trim().optional(),
});

export async function renameGlobalPlayer(formData: FormData) {
  await assertAdmin();
  const parsed = renameSchema.safeParse({
    globalPlayerId: formData.get("globalPlayerId"),
    name: formData.get("name"),
    nickname: formData.get("nickname") || undefined,
  });
  if (!parsed.success) throw new Error(parsed.error.issues.map((i) => i.message).join(", "));

  await prisma.globalPlayer.update({
    where: { id: parsed.data.globalPlayerId },
    data: { name: parsed.data.name, nickname: parsed.data.nickname || null },
  });

  await setFlash("แก้ไขชื่อผู้เล่นแล้ว");
  revalidatePath("/admin/players");
}

const targetSchema = z.object({ globalPlayerId: z.coerce.number().int().positive() });

// Keeps the linked User's login intact — only severs this Player's connection to it, so the
// same (or a different) Google account can be linked again later via a fresh LinkRequest.
export async function unlinkGlobalPlayerAccount(formData: FormData) {
  const admin = await assertAdmin();
  const parsed = targetSchema.safeParse({ globalPlayerId: formData.get("globalPlayerId") });
  if (!parsed.success) throw new Error("ไม่พบผู้เล่น");

  const player = await prisma.globalPlayer.findUniqueOrThrow({
    where: { id: parsed.data.globalPlayerId },
    include: { user: true },
  });
  if (!player.userId) throw new Error("ผู้เล่นนี้ไม่ได้ผูกบัญชีอยู่");

  await prisma.globalPlayer.update({ where: { id: player.id }, data: { userId: null } });

  await logAdminAction({
    actorId: admin.id,
    action: "player.unlink_account",
    summary: `ยกเลิกผูกบัญชี ${player.user!.email} จากผู้เล่น "${player.name}" (${player.id})`,
    targetType: "GlobalPlayer",
    targetId: String(player.id),
  });

  await setFlash("ยกเลิกการผูกบัญชี Google แล้ว");
  revalidatePath("/admin/players");
}

// Deletes the linked User's login account entirely (not just the link) — e.g. for a spam or
// mistakenly-linked account. Only ever touches a plain USER: anyone promoted to Staff/Admin, or
// who created a Tournament, must be handled from Staff/Admins management instead — never as a
// side effect of cleaning up a Player here.
export async function deleteGlobalPlayerAccount(formData: FormData) {
  const admin = await assertAdmin();
  const parsed = targetSchema.safeParse({ globalPlayerId: formData.get("globalPlayerId") });
  if (!parsed.success) throw new Error("ไม่พบผู้เล่น");

  const player = await prisma.globalPlayer.findUniqueOrThrow({
    where: { id: parsed.data.globalPlayerId },
    include: {
      user: { include: { _count: { select: { staffAssignments: true, createdTournaments: true } } } },
    },
  });
  if (!player.user) throw new Error("ผู้เล่นนี้ไม่ได้ผูกบัญชีอยู่");
  if (player.user.role !== "USER") {
    throw new Error("บัญชีนี้เป็น Admin/Staff — ถอดสิทธิ์จากหน้า Admins/Staff ก่อน");
  }
  if (player.user._count.staffAssignments > 0 || player.user._count.createdTournaments > 0) {
    throw new Error("บัญชีนี้เคยเป็น Staff หรือเคยสร้าง Tournament ไว้ ลบไม่ได้");
  }

  await prisma.$transaction([
    // LinkRequest.userId is ON DELETE RESTRICT — must clear the user's own requests first.
    // (reviewedById is ON DELETE SET NULL, so requests they only reviewed are unaffected.)
    prisma.linkRequest.deleteMany({ where: { userId: player.user.id } }),
    prisma.user.delete({ where: { id: player.user.id } }),
  ]);

  await logAdminAction({
    actorId: admin.id,
    action: "player.delete_account",
    summary: `ลบบัญชี ${player.user.email} ของผู้เล่น "${player.name}" (${player.id})`,
    targetType: "GlobalPlayer",
    targetId: String(player.id),
  });

  await setFlash("ลบบัญชีผู้เล่นแล้ว");
  revalidatePath("/admin/players");
}

// Deletes the Player record itself (not just an account link) — e.g. a duplicate or
// mistakenly-created entry. TournamentPlayer.globalPlayerId is ON DELETE RESTRICT, so this is
// only possible for a Player who has never actually been added to a Tournament; once they have
// match/score history, that history must be kept (same rule as removePlayerFromTournament).
export async function deleteGlobalPlayer(formData: FormData) {
  const admin = await assertAdmin();
  const parsed = targetSchema.safeParse({ globalPlayerId: formData.get("globalPlayerId") });
  if (!parsed.success) throw new Error("ไม่พบผู้เล่น");

  const player = await prisma.globalPlayer.findUniqueOrThrow({
    where: { id: parsed.data.globalPlayerId },
    include: { _count: { select: { tournamentPlayers: true } } },
  });
  if (player._count.tournamentPlayers > 0) {
    throw new Error("ผู้เล่นนี้เคยลงแข่งขันแล้ว มีประวัติการแข่งขันอยู่ ลบไม่ได้");
  }

  await prisma.$transaction([
    // LinkRequest.globalPlayerId is ON DELETE RESTRICT — clear any requests for this player first.
    prisma.linkRequest.deleteMany({ where: { globalPlayerId: player.id } }),
    prisma.globalPlayer.delete({ where: { id: player.id } }),
  ]);

  await logAdminAction({
    actorId: admin.id,
    action: "player.delete",
    summary: `ลบผู้เล่น "${player.name}" (${player.id})`,
    targetType: "GlobalPlayer",
    targetId: String(player.id),
  });

  await setFlash("ลบผู้เล่นแล้ว");
  revalidatePath("/admin/players");
}

// Same as deleteGlobalPlayer, but for a Player who HAS tournament/match history — explicit
// opt-in override, confirmed with the admin up front (this is destructive and NOT limited to
// this player: every Match they were ever in is deleted outright, which also erases that game
// from whichever opponent they played, since a Match record inherently belongs to both sides —
// there is no way to keep "half" of a match). Match.player1Id cascades on TournamentPlayer
// delete, but player2Id only SETS NULL (would leave a broken half-populated Match behind), so
// every Match is deleted explicitly first regardless of which side this player was on.
export async function forceDeleteGlobalPlayer(formData: FormData) {
  const admin = await assertAdmin();
  const parsed = targetSchema.safeParse({ globalPlayerId: formData.get("globalPlayerId") });
  if (!parsed.success) throw new Error("ไม่พบผู้เล่น");

  const player = await prisma.globalPlayer.findUniqueOrThrow({
    where: { id: parsed.data.globalPlayerId },
    include: { tournamentPlayers: { select: { id: true, tournamentId: true } } },
  });

  const tournamentPlayerIds = player.tournamentPlayers.map((tp) => tp.id);
  const tournamentIds = [...new Set(player.tournamentPlayers.map((tp) => tp.tournamentId))];

  await prisma.$transaction([
    prisma.match.deleteMany({
      where: {
        OR: [{ player1Id: { in: tournamentPlayerIds } }, { player2Id: { in: tournamentPlayerIds } }],
      },
    }),
    prisma.tournamentPlayer.deleteMany({ where: { id: { in: tournamentPlayerIds } } }),
    prisma.linkRequest.deleteMany({ where: { globalPlayerId: player.id } }),
    prisma.globalPlayer.delete({ where: { id: player.id } }),
  ]);

  const tournamentModes = await prisma.tournament.findMany({
    where: { id: { in: tournamentIds } },
    select: { id: true, mode: true },
  });

  await logAdminAction({
    actorId: admin.id,
    action: "player.force_delete",
    summary: `ลบผู้เล่น "${player.name}" (${player.id}) พร้อมประวัติการแข่งขัน ${tournamentIds.length} Tournament`,
    targetType: "GlobalPlayer",
    targetId: String(player.id),
  });

  await setFlash("ลบผู้เล่นแล้ว (รวมประวัติการแข่งขันทั้งหมด)");
  revalidatePath("/admin/players");
  for (const t of tournamentModes) {
    revalidatePath(`/admin/tournaments/${t.id}`);
    revalidatePath(`/admin/tournaments/${t.id}/rounds`);
    revalidatePath(`/admin/tournaments/${t.id}/players`);
    revalidatePath(publicTournamentPath(t));
  }
}
