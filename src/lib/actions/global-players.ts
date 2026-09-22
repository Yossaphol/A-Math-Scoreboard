"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertAdmin } from "@/lib/dal";
import { setFlash } from "@/lib/flash";

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
  await assertAdmin();
  const parsed = targetSchema.safeParse({ globalPlayerId: formData.get("globalPlayerId") });
  if (!parsed.success) throw new Error("ไม่พบผู้เล่น");

  const player = await prisma.globalPlayer.findUniqueOrThrow({
    where: { id: parsed.data.globalPlayerId },
  });
  if (!player.userId) throw new Error("ผู้เล่นนี้ไม่ได้ผูกบัญชีอยู่");

  await prisma.globalPlayer.update({ where: { id: player.id }, data: { userId: null } });
  await setFlash("ยกเลิกการผูกบัญชี Google แล้ว");
  revalidatePath("/admin/players");
}

// Deletes the linked User's login account entirely (not just the link) — e.g. for a spam or
// mistakenly-linked account. Only ever touches a plain USER: anyone promoted to Staff/Admin, or
// who created a Tournament, must be handled from Staff/Admins management instead — never as a
// side effect of cleaning up a Player here.
export async function deleteGlobalPlayerAccount(formData: FormData) {
  await assertAdmin();
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

  await setFlash("ลบบัญชีผู้เล่นแล้ว");
  revalidatePath("/admin/players");
}
