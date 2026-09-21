import { requireAdmin } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { assignStaff, revokeStaff } from "@/lib/actions/staff";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ConfirmSubmitButton } from "@/components/ui/ConfirmSubmitButton";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { inputClass, labelClass } from "@/components/ui/styles";

export default async function TournamentStaffPage(props: PageProps<"/admin/tournaments/[id]/staff">) {
  const { id } = await props.params;
  await requireAdmin(); // spec §5/§6: Staff assignment is Admin-only, even within a tournament they run.

  const assignments = await prisma.tournamentStaff.findMany({
    where: { tournamentId: id },
    include: { user: true },
    orderBy: { assignedAt: "desc" },
  });

  return (
    <div>
      <Card>
        <form action={assignStaff} className="flex items-end gap-3">
          <input type="hidden" name="tournamentId" value={id} />
          <div className="flex-1">
            <label className={labelClass}>Staff Gmail</label>
            <input name="email" type="email" required className={`${inputClass} mt-1`} />
          </div>
          <Button type="submit">+ Add Staff</Button>
        </form>
      </Card>

      <Card padding="p-0" className="mt-6 overflow-x-auto">
        {assignments.length === 0 ? (
          <div className="p-6">
            <EmptyState title="ยังไม่มี Staff สำหรับ Tournament นี้" />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200/70 text-left text-xs text-neutral-500">
                <th className="py-3 pl-5 pr-3">Email</th>
                <th className="py-3 pr-3">Status</th>
                <th className="py-3 pr-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {assignments.map((a) => (
                <tr key={a.id} className="border-b border-neutral-100 last:border-0">
                  <td className="py-3 pl-5 pr-3">{a.user.email}</td>
                  <td className="py-3 pr-3">
                    <Badge variant={a.status === "ACTIVE" ? "success" : "neutral"}>
                      {a.status}
                    </Badge>
                  </td>
                  <td className="py-3 pr-5 text-right">
                    {a.status === "ACTIVE" && (
                      <form action={revokeStaff}>
                        <input type="hidden" name="staffAssignmentId" value={a.id} />
                        <ConfirmSubmitButton
                          label="Revoke"
                          confirmTitle="ถอด Staff?"
                          confirmMessage={`${a.user.email} จะไม่มีสิทธิ์เข้าจัดการ Tournament นี้อีก`}
                        />
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
