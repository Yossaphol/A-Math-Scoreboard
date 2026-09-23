"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertSuperAdmin } from "@/lib/dal";
import { setFlash } from "@/lib/flash";
import { logAdminAction } from "@/lib/audit-log";

const addAdminSchema = z.object({ email: z.email("อีเมลไม่ถูกต้อง") });

// Only the super admin (SUPER_ADMIN_EMAIL) may add another Admin, matched by Gmail — the
// account is created (or promoted, if it already existed as Staff/User) the moment it's
// added, no separate acceptance step, matching how Google sign-in resolves role by email.
export async function addAdmin(formData: FormData) {
  const superAdmin = await assertSuperAdmin();
  const parsed = addAdminSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) throw new Error(parsed.error.issues.map((i) => i.message).join(", "));

  const target = await prisma.user.upsert({
    where: { email: parsed.data.email },
    update: { role: "ADMIN" },
    create: { email: parsed.data.email, role: "ADMIN" },
  });

  await logAdminAction({
    actorId: superAdmin.id,
    action: "admin.add",
    summary: `เพิ่ม ${target.email} เป็น Admin`,
    targetType: "User",
    targetId: target.id,
  });

  await setFlash(`เพิ่ม ${parsed.data.email} เป็น Admin แล้ว`);
  revalidatePath("/admin/admins");
}

export async function removeAdmin(formData: FormData) {
  const admin = await assertSuperAdmin();
  const userId = String(formData.get("userId"));

  if (userId === admin.id) {
    throw new Error("ไม่สามารถถอดสิทธิ์ Admin ของตัวเองได้");
  }

  const remainingAdmins = await prisma.user.count({ where: { role: "ADMIN" } });
  if (remainingAdmins <= 1) {
    throw new Error("ต้องมี Admin อย่างน้อย 1 คนเสมอ");
  }

  const target = await prisma.user.update({ where: { id: userId }, data: { role: "USER" } });

  await logAdminAction({
    actorId: admin.id,
    action: "admin.remove",
    summary: `ถอดสิทธิ์ Admin ของ ${target.email}`,
    targetType: "User",
    targetId: target.id,
  });

  await setFlash("ถอดสิทธิ์ Admin แล้ว");
  revalidatePath("/admin/admins");
}
