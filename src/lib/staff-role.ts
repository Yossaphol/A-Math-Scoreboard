import "server-only";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Keeps User.role in step with Staff assignments: STAFF exactly while someone has at least one
 * ACTIVE assignment. Without this, a revoked Staff member (or one whose only tournament was
 * deleted) kept the STAFF role and still saw the admin shell until invited again. ADMIN is
 * never touched here.
 */
export async function syncStaffRoles(userIds: string[], db: Prisma.TransactionClient = prisma) {
  if (userIds.length === 0) return;
  await db.user.updateMany({
    where: { id: { in: userIds }, role: "STAFF", staffAssignments: { none: { status: "ACTIVE" } } },
    data: { role: "USER" },
  });
  await db.user.updateMany({
    where: { id: { in: userIds }, role: "USER", staffAssignments: { some: { status: "ACTIVE" } } },
    data: { role: "STAFF" },
  });
}
