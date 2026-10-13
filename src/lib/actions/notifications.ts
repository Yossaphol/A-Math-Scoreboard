"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/dal";
import { unstable_update } from "@/auth";
import { setFlash } from "@/lib/flash";
import { notify } from "@/lib/notifications";
import { logAdminAction } from "@/lib/audit-log";

async function requireSignedIn() {
  const session = await getSession();
  if (!session?.user) throw new Error("ต้อง Login ก่อน");
  return session.user;
}

export async function markNotificationsRead() {
  const user = await requireSignedIn();
  await prisma.userNotification.updateMany({
    where: { userId: user.id, readAt: null },
    data: { readAt: new Date() },
  });
  revalidatePath("/", "layout");
}

const respondSchema = z.object({
  assignmentId: z.string().min(1),
  decision: z.enum(["accept", "decline"]),
});

// The invited person answers a Staff invite. Only they can, and only while it's still open.
// Accepting is what actually grants access (and the STAFF role, for a plain User).
export async function respondStaffInvite(formData: FormData) {
  const user = await requireSignedIn();
  const parsed = respondSchema.safeParse({
    assignmentId: formData.get("assignmentId"),
    decision: formData.get("decision"),
  });
  if (!parsed.success) throw new Error("ข้อมูลไม่ครบ");
  const { assignmentId, decision } = parsed.data;

  const assignment = await prisma.tournamentStaff.findUnique({
    where: { id: assignmentId },
    include: { tournament: { select: { id: true, name: true } } },
  });
  if (!assignment || assignment.userId !== user.id) throw new Error("ไม่พบคำเชิญนี้");
  if (assignment.status !== "INVITED") {
    await setFlash({ type: "info", title: "ตอบคำเชิญนี้ไปแล้ว" });
    revalidatePath("/", "layout");
    return;
  }

  const accept = decision === "accept";
  await prisma.$transaction(async (tx) => {
    await tx.tournamentStaff.update({
      where: { id: assignmentId },
      data: { status: accept ? "ACTIVE" : "DECLINED", respondedAt: new Date() },
    });
    if (accept) {
      // Never downgrade an Admin; a plain User becomes Staff.
      await tx.user.updateMany({ where: { id: user.id, role: "USER" }, data: { role: "STAFF" } });
    }
    await tx.userNotification.updateMany({
      where: { staffAssignmentId: assignmentId, readAt: null },
      data: { readAt: new Date() },
    });
  });

  const who = user.name || user.email || "Staff";
  if (assignment.invitedById) {
    await notify(assignment.invitedById, {
      kind: "STAFF_INVITE_ANSWERED",
      title: accept ? `${who} ตอบรับเป็น Staff แล้ว` : `${who} ปฏิเสธคำเชิญ Staff`,
      body: assignment.tournament.name,
      href: `/admin/tournaments/${assignment.tournament.id}/staff`,
    });
  }
  // Recorded as the invited person's own action — the audit log is about who changed access.
  await logAdminAction({
    actorId: user.id,
    action: accept ? "staff.accept" : "staff.decline",
    summary: `${who} ${accept ? "ตอบรับ" : "ปฏิเสธ"}คำเชิญ Staff ของ "${assignment.tournament.name}"`,
    targetType: "TournamentStaff",
    targetId: assignment.tournament.id,
  });
  revalidatePath("/", "layout");

  if (accept) {
    // Refresh the session right away so /admin opens without signing out and back in.
    await unstable_update({});
    await setFlash({ type: "success", title: "เข้าร่วมเป็น Staff แล้ว", description: assignment.tournament.name });
    redirect(`/admin/tournaments/${assignment.tournament.id}`);
  }
  await setFlash({ type: "info", title: "ปฏิเสธคำเชิญแล้ว", description: assignment.tournament.name });
}

// Removing notifications from your own list. A Staff invite that's still waiting for an answer
// stays — deleting it would leave no way to accept or decline.
const openInvite = { staffAssignment: { status: "INVITED" as const } };

export async function deleteNotification(id: string) {
  const user = await requireSignedIn();
  await prisma.userNotification.deleteMany({ where: { id, userId: user.id, NOT: openInvite } });
  revalidatePath("/", "layout");
}

export async function clearNotifications() {
  const user = await requireSignedIn();
  await prisma.userNotification.deleteMany({
    where: { userId: user.id, OR: [{ staffAssignmentId: null }, { NOT: openInvite }] },
  });
  revalidatePath("/", "layout");
}
