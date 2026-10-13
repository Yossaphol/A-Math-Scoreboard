import "server-only";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/generated/prisma/enums";

// A screen counts as online while its admin live stream keeps touching its row (every ~30s,
// see the stream route) — 45s gives one missed beat of slack before it drops off.
export const PRESENCE_TOUCH_MS = 30_000;
const ONLINE_WINDOW_MS = 45_000;
// Rows of screens that never came back are cleared after this long.
const FORGET_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

function onlineCutoff() {
  return new Date(Date.now() - ONLINE_WINDOW_MS);
}

export async function touchPresence(userId: string, deviceId: string, soundMuted: boolean) {
  await prisma.staffPresence.upsert({
    where: { userId_deviceId: { userId, deviceId } },
    update: { lastSeenAt: new Date(), soundMuted },
    create: { userId, deviceId, soundMuted, lastSeenAt: new Date() },
  });
}

export async function forgetStalePresence() {
  await prisma.staffPresence.deleteMany({ where: { lastSeenAt: { lt: new Date(Date.now() - FORGET_AFTER_MS) } } });
}

export type OnlineStaff = { id: string; name: string; role: Role; soundMuted: boolean };

/**
 * Admin/Staff online now, as one viewer may see them: an Admin sees everyone; a Staff member
 * sees Admins plus Staff who share at least one tournament with them.
 */
export async function listOnlineStaff(viewer: { id: string; role: Role }): Promise<OnlineStaff[]> {
  const rows = await prisma.staffPresence.findMany({
    where: {
      lastSeenAt: { gt: onlineCutoff() },
      user: {
        role: { in: ["ADMIN", "STAFF"] },
        ...(viewer.role === "ADMIN"
          ? {}
          : {
              OR: [
                { role: "ADMIN" },
                { id: viewer.id },
                {
                  staffAssignments: {
                    some: {
                      status: "ACTIVE",
                      tournament: { staff: { some: { userId: viewer.id, status: "ACTIVE" } } },
                    },
                  },
                },
              ],
            }),
      },
    },
    select: { soundMuted: true, user: { select: { id: true, name: true, email: true, role: true } } },
  });

  // One entry per person; muted only if every screen they have open is muted.
  const byUser = new Map<string, OnlineStaff>();
  for (const r of rows) {
    const prev = byUser.get(r.user.id);
    byUser.set(r.user.id, {
      id: r.user.id,
      name: r.user.name || r.user.email,
      role: r.user.role,
      soundMuted: (prev?.soundMuted ?? true) && r.soundMuted,
    });
  }
  return [...byUser.values()].sort(
    (a, b) => Number(b.role === "ADMIN") - Number(a.role === "ADMIN") || a.name.localeCompare(b.name, "th")
  );
}

/** How many people could answer a referee call at this tournament right now. */
export async function countOnlineReferees(tournamentId: string) {
  const rows = await prisma.staffPresence.findMany({
    where: {
      lastSeenAt: { gt: onlineCutoff() },
      user: {
        OR: [
          { role: "ADMIN" },
          { role: "STAFF", staffAssignments: { some: { tournamentId, status: "ACTIVE" } } },
        ],
      },
    },
    select: { userId: true },
    distinct: ["userId"],
  });
  return rows.length;
}
