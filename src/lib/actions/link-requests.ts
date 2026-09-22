"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession, assertAdmin } from "@/lib/dal";
import { setFlash } from "@/lib/flash";

const requestSchema = z.object({ globalPlayerId: z.coerce.number().int().positive() });

// Spec §4: a User can never link themselves directly — it always goes through an Admin
// Approval step, so nobody can claim someone else's playing history by mistake.
export async function requestPlayerLink(formData: FormData) {
  const session = await getSession();
  if (!session?.user) throw new Error("ต้อง Login ก่อน");

  const parsed = requestSchema.safeParse({ globalPlayerId: formData.get("globalPlayerId") });
  if (!parsed.success) throw new Error("ไม่พบผู้เล่นที่เลือก");
  const { globalPlayerId } = parsed.data;

  const [alreadyLinkedToMe, player, pending] = await Promise.all([
    prisma.globalPlayer.findUnique({ where: { userId: session.user.id } }),
    prisma.globalPlayer.findUniqueOrThrow({ where: { id: globalPlayerId } }),
    prisma.linkRequest.findFirst({
      where: { userId: session.user.id, globalPlayerId, status: "PENDING" },
    }),
  ]);
  if (alreadyLinkedToMe) throw new Error("บัญชีนี้ผูกกับผู้เล่นอยู่แล้ว");
  if (player.userId) throw new Error("ผู้เล่นนี้ถูกผูกกับบัญชีอื่นแล้ว");
  if (pending) throw new Error("มีคำขอที่รอตรวจสอบอยู่แล้วสำหรับผู้เล่นนี้");

  await prisma.linkRequest.create({
    data: { userId: session.user.id, globalPlayerId, status: "PENDING" },
  });

  await setFlash("ส่งคำขอผูกบัญชีแล้ว รอ Admin ตรวจสอบ");
  revalidatePath("/account");
}

const updateOwnNameSchema = z.object({
  name: z.string().trim().min(1, "กรุณากรอกชื่อ"),
  nickname: z.string().trim().optional(),
});

// A User may only rename the Player they're linked to (via userId), never anyone else's —
// this is the self-service counterpart to Admin's renameGlobalPlayer in global-players.ts.
export async function updateOwnPlayerName(formData: FormData) {
  const session = await getSession();
  if (!session?.user) throw new Error("ต้อง Login ก่อน");

  const parsed = updateOwnNameSchema.safeParse({
    name: formData.get("name"),
    nickname: formData.get("nickname") || undefined,
  });
  if (!parsed.success) throw new Error(parsed.error.issues.map((i) => i.message).join(", "));

  const player = await prisma.globalPlayer.findUnique({ where: { userId: session.user.id } });
  if (!player) throw new Error("บัญชีนี้ยังไม่ได้ผูกกับผู้เล่น");

  await prisma.globalPlayer.update({
    where: { id: player.id },
    data: { name: parsed.data.name, nickname: parsed.data.nickname || null },
  });

  await setFlash("แก้ไขชื่อแล้ว");
  revalidatePath("/account");
}

export async function approveLinkRequest(formData: FormData) {
  const admin = await assertAdmin();
  const requestId = String(formData.get("requestId"));

  const request = await prisma.linkRequest.findUniqueOrThrow({ where: { id: requestId } });
  if (request.status !== "PENDING") throw new Error("คำขอนี้ถูกตรวจสอบไปแล้ว");

  const conflict = await prisma.globalPlayer.findUnique({
    where: { id: request.globalPlayerId },
  });
  if (conflict?.userId && conflict.userId !== request.userId) {
    throw new Error("ผู้เล่นนี้ถูกผูกกับบัญชีอื่นไปแล้วระหว่างรอตรวจสอบ");
  }

  await prisma.$transaction([
    prisma.globalPlayer.update({
      where: { id: request.globalPlayerId },
      data: { userId: request.userId },
    }),
    prisma.linkRequest.update({
      where: { id: requestId },
      data: { status: "APPROVED", reviewedById: admin.id, reviewedAt: new Date() },
    }),
  ]);

  await setFlash("อนุมัติคำขอผูกบัญชีแล้ว");
  revalidatePath("/admin/account-requests");
}

export async function rejectLinkRequest(formData: FormData) {
  const admin = await assertAdmin();
  const requestId = String(formData.get("requestId"));

  const request = await prisma.linkRequest.findUniqueOrThrow({ where: { id: requestId } });
  if (request.status !== "PENDING") throw new Error("คำขอนี้ถูกตรวจสอบไปแล้ว");

  await prisma.linkRequest.update({
    where: { id: requestId },
    data: { status: "REJECTED", reviewedById: admin.id, reviewedAt: new Date() },
  });

  await setFlash("ปฏิเสธคำขอผูกบัญชีแล้ว");
  revalidatePath("/admin/account-requests");
}
