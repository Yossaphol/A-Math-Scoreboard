import "server-only";
import { prisma } from "@/lib/prisma";
import type { NotificationKind, StaffStatus } from "@/generated/prisma/enums";

export async function notify(
  userId: string,
  n: { kind: NotificationKind; title: string; body?: string; href?: string; staffAssignmentId?: string }
) {
  await prisma.userNotification.create({ data: { userId, ...n } });
}

/** What the user menu / admin bell show — serializable, so client components can render it. */
export type InboxItem = {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string | null;
  href: string | null;
  createdAt: string;
  unread: boolean;
  // For a Staff invite: its current state, so the buttons only show while it's still open.
  invite: { assignmentId: string; status: StaffStatus; tournamentId: string } | null;
};

const INBOX_SIZE = 15;

export async function getInbox(userId: string): Promise<{ items: InboxItem[]; unread: number }> {
  const [rows, unread] = await Promise.all([
    prisma.userNotification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: INBOX_SIZE,
      include: { staffAssignment: { select: { id: true, status: true, tournamentId: true } } },
    }),
    prisma.userNotification.count({ where: { userId, readAt: null } }),
  ]);
  return {
    unread,
    items: rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      title: r.title,
      body: r.body,
      href: r.href,
      createdAt: r.createdAt.toISOString(),
      unread: !r.readAt,
      invite: r.staffAssignment
        ? { assignmentId: r.staffAssignment.id, status: r.staffAssignment.status, tournamentId: r.staffAssignment.tournamentId }
        : null,
    })),
  };
}

/** Tournaments this person is active Staff on — quick links in the user menu. */
export async function getStaffTournaments(userId: string) {
  const rows = await prisma.tournamentStaff.findMany({
    where: { userId, status: "ACTIVE", tournament: { status: { not: "COMPLETED" } } },
    select: { tournament: { select: { id: true, name: true } } },
    orderBy: { assignedAt: "desc" },
  });
  return rows.map((r) => r.tournament);
}
