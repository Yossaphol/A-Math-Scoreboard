"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertAdmin } from "@/lib/dal";
import { setFlash } from "@/lib/flash";

const addAdminSchema = z.object({ email: z.email("อีเมลไม่ถูกต้อง") });

// Spec §5: only an Admin can add another Admin, matched by Gmail — the account is created
// (or promoted, if it already existed as Staff/User) the moment it's added, no separate
// acceptance step, matching how Google sign-in resolves role by email.
export async function addAdmin(formData: FormData) {
  await assertAdmin();
  const parsed = addAdminSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) throw new Error(parsed.error.issues.map((i) => i.message).join(", "));

  await prisma.user.upsert({
    where: { email: parsed.data.email },
    update: { role: "ADMIN" },
    create: { email: parsed.data.email, role: "ADMIN" },
  });

  await setFlash(`เพิ่ม ${parsed.data.email} เป็น Admin แล้ว`);
  revalidatePath("/admin/admins");
}

export async function removeAdmin(formData: FormData) {
  const admin = await assertAdmin();
  const userId = String(formData.get("userId"));

  if (userId === admin.id) {
    throw new Error("ไม่สามารถถอดสิทธิ์ Admin ของตัวเองได้");
  }

  const remainingAdmins = await prisma.user.count({ where: { role: "ADMIN" } });
  if (remainingAdmins <= 1) {
    throw new Error("ต้องมี Admin อย่างน้อย 1 คนเสมอ");
  }

  await prisma.user.update({ where: { id: userId }, data: { role: "USER" } });

  await setFlash("ถอดสิทธิ์ Admin แล้ว");
  revalidatePath("/admin/admins");
}
