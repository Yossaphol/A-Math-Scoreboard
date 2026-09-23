import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * Central admin/staff action trail — added because none of the consequential admin actions
 * (add/remove Admin, assign/revoke Staff, delete/unlink a Player, delete a Tournament,
 * override a match result) previously left any record of who did it. Deliberately not used
 * for anonymous player score entry (/table, /practice/play), which already has its own trail
 * via MatchSubmission and has no logged-in actor to attribute to.
 */
export async function logAdminAction({
  actorId,
  action,
  summary,
  targetType,
  targetId,
}: {
  actorId: string;
  action: string;
  summary: string;
  targetType?: string;
  targetId?: string;
}): Promise<void> {
  await prisma.auditLog.create({
    data: { actorId, action, summary, targetType, targetId },
  });
}
