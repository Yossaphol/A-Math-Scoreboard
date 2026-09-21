"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertAdmin } from "@/lib/dal";
import { setFlash } from "@/lib/flash";

const assignSchema = z.object({
  tournamentId: z.string().min(1),
  email: z.email("อีเมลไม่ถูกต้อง"),
});

// Spec §5/§6: only Admin can add/remove Staff, and it's always scoped to one Tournament.
export async function assignStaff(formData: FormData) {
  await assertAdmin();

  const parsed = assignSchema.safeParse({
    tournamentId: formData.get("tournamentId"),
    email: formData.get("email"),
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((i) => i.message).join(", "));
  }
  const { tournamentId, email } = parsed.data;

  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, role: "STAFF" },
  });

  await prisma.tournamentStaff.upsert({
    where: { userId_tournamentId: { userId: user.id, tournamentId } },
    update: { status: "ACTIVE" },
    create: { userId: user.id, tournamentId, status: "ACTIVE" },
  });

  await setFlash(`เพิ่ม ${email} เป็น Staff แล้ว`);
  revalidatePath(`/admin/tournaments/${tournamentId}/staff`);
  revalidatePath("/admin/staff");
}

export async function revokeStaff(formData: FormData) {
  await assertAdmin();
  const staffAssignmentId = String(formData.get("staffAssignmentId"));

  const assignment = await prisma.tournamentStaff.update({
    where: { id: staffAssignmentId },
    data: { status: "REVOKED" },
  });

  await setFlash("ถอด Staff แล้ว");
  revalidatePath(`/admin/tournaments/${assignment.tournamentId}/staff`);
  revalidatePath("/admin/staff");
}
