import Link from "next/link";
import { requireAdmin } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { revokeStaff } from "@/lib/actions/staff";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ConfirmSubmitButton } from "@/components/ui/ConfirmSubmitButton";
import { EmptyState } from "@/components/ui/EmptyState";

export default async function StaffAssignmentsPage() {
  await requireAdmin();

  const assignments = await prisma.tournamentStaff.findMany({
    orderBy: { assignedAt: "desc" },
    include: { user: true, tournament: true },
  });

  return (
    <div>
      <PageHeader
        title="Staff Assignments"
        subtitle='เพิ่ม Staff รายคนต่อ Tournament ได้จากหน้า Tournament นั้น ๆ (tab "Staff")'
      />

      {assignments.length === 0 ? (
        <EmptyState title="ยังไม่มี Staff assignment" />
      ) : (
        <Card padding="p-0" className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200/70 text-left text-xs text-neutral-500">
                <th className="py-3 pl-5 pr-3">Email</th>
                <th className="py-3 pr-3">Tournament</th>
                <th className="py-3 pr-3">Status</th>
                <th className="py-3 pr-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {assignments.map((a) => (
                <tr key={a.id} className="border-b border-neutral-100 last:border-0">
                  <td className="py-3 pl-5 pr-3">{a.user.email}</td>
                  <td className="py-3 pr-3">
                    <Link href={`/admin/tournaments/${a.tournamentId}`} className="hover:underline">
                      {a.tournament.name}
                    </Link>
                  </td>
                  <td className="py-3 pr-3">
                    <Badge variant={a.status === "ACTIVE" ? "success" : "neutral"}>{a.status}</Badge>
                  </td>
                  <td className="py-3 pr-5 text-right">
                    {a.status === "ACTIVE" && (
                      <form action={revokeStaff}>
                        <input type="hidden" name="staffAssignmentId" value={a.id} />
                        <ConfirmSubmitButton
                          label="Revoke"
                          confirmTitle="ถอด Staff?"
                          confirmMessage={`${a.user.email} จะไม่มีสิทธิ์เข้าจัดการ ${a.tournament.name} อีก`}
                        />
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
