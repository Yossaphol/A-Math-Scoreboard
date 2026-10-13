"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertAdmin } from "@/lib/dal";
import { logAdminAction } from "@/lib/audit-log";
import { setFlash } from "@/lib/flash";
import { notify } from "@/lib/notifications";
import { syncStaffRoles } from "@/lib/staff-role";

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

  // Adding someone is an invite: they get a notification and only gain access (and the
  // STAFF role) once they accept it — see respondStaffInvite. Someone who hasn't signed in yet
  // gets a plain User row and finds the invite waiting on their first Google sign-in.
  // Admins already reach every tournament, so they're simply added as active.
  const tournament = await prisma.tournament.findUniqueOrThrow({
    where: { id: tournamentId },
    select: { name: true },
  });
  const user =
    (await prisma.user.findUnique({ where: { email } })) ??
    (await prisma.user.create({ data: { email, role: "USER" } }));

  const current = await prisma.tournamentStaff.findUnique({
    where: { userId_tournamentId: { userId: user.id, tournamentId } },
  });
  if (current?.status === "ACTIVE" || current?.status === "INVITED") {
    await setFlash({
      type: "info",
      title: current.status === "ACTIVE" ? "เป็น Staff อยู่แล้ว" : "ส่งคำเชิญไปแล้ว",
      description: current.status === "ACTIVE" ? email : `${email} ยังไม่ได้ตอบรับ`,
    });
    revalidatePath(`/admin/tournaments/${tournamentId}/staff`);
    return;
  }

  const status = user.role === "ADMIN" ? "ACTIVE" : "INVITED";
  const assignment = await prisma.tournamentStaff.upsert({
    where: { userId_tournamentId: { userId: user.id, tournamentId } },
    update: { status, invitedById: admin.id, assignedAt: new Date(), respondedAt: null },
    create: { userId: user.id, tournamentId, status, invitedById: admin.id },
  });
  if (status === "INVITED") {
    await notify(user.id, {
      kind: "STAFF_INVITE",
      title: `คำเชิญเป็น Staff · ${tournament.name}`,
      body: `${admin.name || admin.email} เชิญให้ช่วยจัดการ Tournament นี้ (จัดคู่ กรอกผล รับเรียกกรรมการ)`,
      staffAssignmentId: assignment.id,
    });
  }

  await logAdminAction({
    actorId: admin.id,
    action: "staff.assign",
    summary: `${status === "INVITED" ? "เชิญ" : "เพิ่ม"} ${email} เป็น Staff ของ "${tournament.name}"`,
    targetType: "TournamentStaff",
    targetId: tournamentId,
  });

  await setFlash(
    status === "INVITED"
      ? { type: "success", title: "ส่งคำเชิญแล้ว", description: `${email} จะเห็นคำเชิญในเมนูการแจ้งเตือน` }
      : { type: "success", title: "เพิ่ม Staff แล้ว", description: email }
  );
  revalidatePath(`/admin/tournaments/${tournamentId}/staff`);
  revalidatePath("/admin/staff");
}

export async function revokeStaff(formData: FormData) {
  const admin = await assertAdmin();
  const staffAssignmentId = String(formData.get("staffAssignmentId"));

  const before = await prisma.tournamentStaff.findUniqueOrThrow({ where: { id: staffAssignmentId } });
  const assignment = await prisma.tournamentStaff.update({
    where: { id: staffAssignmentId },
    data: { status: "REVOKED" },
    include: { user: true, tournament: { select: { name: true } } },
  });
  // No ACTIVE assignment left → back to a plain User, so the admin pages go away too
  // (within the session's role refresh, ~30s) until they're invited again.
  await syncStaffRoles([assignment.userId]);
  if (before.status === "ACTIVE") {
    await notify(assignment.userId, {
      kind: "STAFF_REMOVED",
      title: `ถูกถอดจาก Staff · ${assignment.tournament.name}`,
      body: "ไม่มีสิทธิ์จัดการ Tournament นี้แล้ว — ถ้าต้องการช่วยต่อ ติดต่อ Admin ให้เชิญใหม่",
    });
  }

  await logAdminAction({
    actorId: admin.id,
    action: before.status === "INVITED" ? "staff.invite_cancel" : "staff.revoke",
    summary:
      before.status === "INVITED"
        ? `ยกเลิกคำเชิญ ${assignment.user.email} เป็น Staff ของ "${assignment.tournament.name}"`
        : `ถอด ${assignment.user.email} จาก Staff ของ "${assignment.tournament.name}"`,
    targetType: "TournamentStaff",
    targetId: assignment.tournamentId,
  });

  revalidatePath(`/admin/tournaments/${assignment.tournamentId}/staff`);
  revalidatePath("/admin/staff");
}
