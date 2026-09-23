"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertAdmin } from "@/lib/dal";
import { setFlash } from "@/lib/flash";
import { logAdminAction } from "@/lib/audit-log";

const assignSchema = z.object({
  tournamentId: z.string().min(1),
  email: z.email("อีเมลไม่ถูกต้อง"),
});

// Spec §5/§6: only Admin can add/remove Staff, and it's always scoped to one Tournament.
export async function assignStaff(formData: FormData) {
  const admin = await assertAdmin();

  const parsed = assignSchema.safeParse({
    tournamentId: formData.get("tournamentId"),
    email: formData.get("email"),
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((i) => i.message).join(", "));
  }
  const { tournamentId, email } = parsed.data;

  // Must promote an existing User too, not just create new ones as STAFF — otherwise anyone
  // who already signed in once (auto-provisioned as plain USER) gets a TournamentStaff row
  // but keeps role=USER, and requireStaffOrAdmin still locks them out of /admin entirely.
  // Never downgrade an existing ADMIN, though — being made Staff on a Tournament is additive.
  const existing = await prisma.user.findUnique({ where: { email } });
  const user =
    existing?.role === "ADMIN"
      ? existing
      : existing
        ? await prisma.user.update({ where: { id: existing.id }, data: { role: "STAFF" } })
        : await prisma.user.create({ data: { email, role: "STAFF" } });

  await prisma.tournamentStaff.upsert({
    where: { userId_tournamentId: { userId: user.id, tournamentId } },
    update: { status: "ACTIVE" },
    create: { userId: user.id, tournamentId, status: "ACTIVE" },
  });

  await logAdminAction({
    actorId: admin.id,
    action: "staff.assign",
    summary: `เพิ่ม ${email} เป็น Staff ของ Tournament`,
    targetType: "TournamentStaff",
    targetId: tournamentId,
  });

  await setFlash(`เพิ่ม ${email} เป็น Staff แล้ว`);
  revalidatePath(`/admin/tournaments/${tournamentId}/staff`);
  revalidatePath("/admin/staff");
}

export async function revokeStaff(formData: FormData) {
  const admin = await assertAdmin();
  const staffAssignmentId = String(formData.get("staffAssignmentId"));

  const assignment = await prisma.tournamentStaff.update({
    where: { id: staffAssignmentId },
    data: { status: "REVOKED" },
    include: { user: true },
  });

  await logAdminAction({
    actorId: admin.id,
    action: "staff.revoke",
    summary: `ถอด ${assignment.user.email} จาก Staff ของ Tournament`,
    targetType: "TournamentStaff",
    targetId: assignment.tournamentId,
  });

  await setFlash("ถอด Staff แล้ว");
  revalidatePath(`/admin/tournaments/${assignment.tournamentId}/staff`);
  revalidatePath("/admin/staff");
}
