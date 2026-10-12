import { requireAdmin } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { assignStaff, revokeStaff } from "@/lib/actions/staff";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { ConfirmSubmitButton } from "@/components/ui/ConfirmSubmitButton";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { STAFF_STATUS_BADGE } from "@/lib/status-labels";
import { inputClass, labelClass } from "@/components/ui/styles";

export default async function TournamentStaffPage(props: PageProps<"/admin/tournaments/[id]/staff">) {
  const { id } = await props.params;
  await requireAdmin(); // spec §5/§6: Staff assignment is Admin-only, even within a tournament they run.

  const assignments = await prisma.tournamentStaff.findMany({
    where: { tournamentId: id },
    include: { user: true },
    orderBy: { assignedAt: "desc" },
  });
  // Active staff first; revoked ones stay listed (and can be re-added) below them.
  assignments.sort((a, b) => Number(a.status === "REVOKED") - Number(b.status === "REVOKED"));
  const activeCount = assignments.filter((a) => a.status === "ACTIVE").length;

  return (
    <div>
      <Card>
        <form action={assignStaff} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="tournamentId" value={id} />
          <div className="min-w-[14rem] flex-1">
            <label className={labelClass}>Staff Gmail</label>
            <input
              name="email"
              type="email"
              required
              placeholder="name@gmail.com"
              className={`${inputClass} mt-1`}
            />
          </div>
          <Button type="submit">+ Add Staff</Button>
        </form>
        <p className="mt-2 text-xs text-neutral-500">
          Staff ต้องเข้าสู่ระบบด้วยปุ่ม &quot;เข้าสู่ระบบด้วย Google&quot; โดยใช้ Gmail นี้ จึงจะจัดการ Tournament นี้ได้
          (เฉพาะ Tournament นี้เท่านั้น)
        </p>
      </Card>

      {assignments.length > 0 && (
        <p className="mb-2 mt-6 text-xs text-neutral-500">
          Staff ที่ใช้งานอยู่ {activeCount} คน
          {assignments.length > activeCount ? ` · ถูกถอดแล้ว ${assignments.length - activeCount} คน` : ""}
        </p>
      )}

      <Card padding="p-0" className={`overflow-x-auto ${assignments.length > 0 ? "" : "mt-6"}`}>
        {assignments.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title="ยังไม่มี Staff สำหรับ Tournament นี้"
              description="เพิ่ม Gmail ด้านบนเพื่อให้คนอื่นช่วยจัดการ Round และกรอกผลได้"
            />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200/70 text-left text-xs text-neutral-500">
                <th className="py-3 pl-5 pr-3">Staff</th>
                <th className="py-3 pr-3">เพิ่มเมื่อ</th>
                <th className="py-3 pr-3">สถานะ</th>
                <th className="py-3 pr-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {assignments.map((a) => {
                const status = STAFF_STATUS_BADGE[a.status];
                const revoked = a.status === "REVOKED";
                return (
                  <tr key={a.id} className={`border-b border-neutral-100 last:border-0 ${revoked ? "text-neutral-400" : ""}`}>
                    <td className="py-3 pl-5 pr-3">
                      {/* name is filled in on their first Google sign-in — until then only the email is known. */}
                      <p className="font-medium">{a.user.name ?? a.user.email}</p>
                      {a.user.name ? (
                        <p className="text-xs text-neutral-500">{a.user.email}</p>
                      ) : (
                        <p className="text-xs text-warning">ยังไม่เคยเข้าสู่ระบบ</p>
                      )}
                    </td>
                    <td className="whitespace-nowrap py-3 pr-3 text-xs text-neutral-500">
                      {a.assignedAt.toLocaleDateString("th-TH", { dateStyle: "medium", timeZone: "Asia/Bangkok" })}
                    </td>
                    <td className="py-3 pr-3">
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </td>
                    <td className="py-3 pr-5 text-right">
                      {revoked ? (
                        // assignStaff upserts, so re-adding the same email just reactivates this row.
                        <form action={assignStaff} className="inline-block">
                          <input type="hidden" name="tournamentId" value={id} />
                          <input type="hidden" name="email" value={a.user.email} />
                          <SubmitButton size="sm" variant="secondary">
                            เพิ่มกลับ
                          </SubmitButton>
                        </form>
                      ) : (
                        <form action={revokeStaff} className="inline-block">
                          <input type="hidden" name="staffAssignmentId" value={a.id} />
                          <ConfirmSubmitButton
                            label="Revoke"
                            confirmTitle="ถอด Staff?"
                            confirmMessage={`${a.user.email} จะไม่มีสิทธิ์เข้าจัดการ Tournament นี้อีก`}
                            size="sm"
                          />
                        </form>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
