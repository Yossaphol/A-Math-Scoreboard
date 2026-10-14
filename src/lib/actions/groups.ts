"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertTournamentAccess } from "@/lib/dal";
import { setFlash } from "@/lib/flash";
import { publicTournamentPath } from "@/lib/tournament-path";

// Pairing groups (ชาย / หญิง, ...) of one Tournament — see TournamentGroup in the schema.

// Groups shape the Scoreboard too, admin and public.
async function revalidateTournament(tournamentId: string) {
  const { mode } = await prisma.tournament.findUniqueOrThrow({ where: { id: tournamentId }, select: { mode: true } });
  revalidatePath(`/admin/tournaments/${tournamentId}`, "layout");
  revalidatePath(publicTournamentPath({ id: tournamentId, mode }), "layout");
}

export async function createGroup(formData: FormData) {
  const tournamentId = String(formData.get("tournamentId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  await assertTournamentAccess(tournamentId);
  if (!name) throw new Error("ต้องใส่ชื่อกลุ่ม");

  const taken = await prisma.tournamentGroup.findUnique({
    where: { tournamentId_name: { tournamentId, name } },
  });
  if (taken) {
    await setFlash({ type: "error", title: "สร้างกลุ่มไม่ได้", description: `มีกลุ่ม "${name}" อยู่แล้ว` });
  } else {
    await prisma.tournamentGroup.create({ data: { tournamentId, name } });
  }
  await revalidateTournament(tournamentId);
}

export async function renameGroup(formData: FormData) {
  const groupId = String(formData.get("groupId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const group = await prisma.tournamentGroup.findUniqueOrThrow({ where: { id: groupId } });
  await assertTournamentAccess(group.tournamentId);
  if (!name || name === group.name) return;

  const taken = await prisma.tournamentGroup.findUnique({
    where: { tournamentId_name: { tournamentId: group.tournamentId, name } },
  });
  if (taken) {
    await setFlash({ type: "error", title: "เปลี่ยนชื่อกลุ่มไม่ได้", description: `มีกลุ่ม "${name}" อยู่แล้ว` });
  } else {
    await prisma.tournamentGroup.update({ where: { id: groupId }, data: { name } });
  }
  await revalidateTournament(group.tournamentId);
}

// Only a group no Round has been split by yet — a played split Round keeps naming its groups.
// Its players simply go back to having no group.
export async function deleteGroup(formData: FormData) {
  const groupId = String(formData.get("groupId") ?? "");
  const group = await prisma.tournamentGroup.findUniqueOrThrow({
    where: { id: groupId },
    include: { _count: { select: { roundMethods: true } } },
  });
  await assertTournamentAccess(group.tournamentId);

  if (group._count.roundMethods > 0) {
    await setFlash({
      type: "error",
      title: "ลบกลุ่มไม่ได้",
      description: `กลุ่ม "${group.name}" ถูกใช้แยกจับคู่ไปแล้ว ${group._count.roundMethods} Round — เปลี่ยนชื่อได้ แต่ลบไม่ได้`,
    });
  } else {
    await prisma.tournamentGroup.delete({ where: { id: groupId } });
  }
  await revalidateTournament(group.tournamentId);
}

// Empty groupId = no group.
export async function setPlayerGroup(formData: FormData) {
  const tournamentPlayerId = String(formData.get("tournamentPlayerId") ?? "");
  const groupId = String(formData.get("groupId") ?? "") || null;
  const tp = await prisma.tournamentPlayer.findUniqueOrThrow({ where: { id: tournamentPlayerId } });
  await assertTournamentAccess(tp.tournamentId);

  if (groupId) {
    const group = await prisma.tournamentGroup.findUnique({ where: { id: groupId } });
    if (group?.tournamentId !== tp.tournamentId) throw new Error("ไม่พบกลุ่มนี้ใน Tournament");
  }
  await prisma.tournamentPlayer.update({ where: { id: tournamentPlayerId }, data: { groupId } });
  await revalidateTournament(tp.tournamentId);
}
