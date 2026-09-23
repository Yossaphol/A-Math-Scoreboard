import { requireAdmin, SUPER_ADMIN_EMAIL } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { addAdmin, removeAdmin } from "@/lib/actions/admins";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ConfirmSubmitButton } from "@/components/ui/ConfirmSubmitButton";

export default async function AdminsPage() {
  const me = await requireAdmin();
  const isSuperAdmin = me.email === SUPER_ADMIN_EMAIL;

  const admins = await prisma.user.findMany({
    where: { role: "ADMIN" },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div>
      <PageHeader title="Admins" subtitle="จัดการผู้ดูแลระบบระดับ Global" />

      {isSuperAdmin ? (
        <Card>
          <form action={addAdmin} className="flex flex-wrap items-end gap-3">
            <div className="min-w-0 flex-1">
              <label className="text-xs text-neutral-500">Gmail ของ Admin คนใหม่</label>
              <input
                name="email"
                type="email"
                required
                className="mt-1 w-full rounded-lg border border-neutral-200 bg-white/70 px-3 py-2 text-sm outline-none focus:border-accent"
              />
            </div>
            <Button type="submit">+ Add Admin</Button>
          </form>
        </Card>
      ) : (
        <Card>
          <p className="text-sm text-neutral-500">
            มีเฉพาะ {SUPER_ADMIN_EMAIL} เท่านั้นที่เพิ่มหรือถอดสิทธิ์ Admin ได้ — หากต้องการมอบสิทธิ์ให้ทีมงาน ให้เพิ่มเป็น Staff แทน
          </p>
        </Card>
      )}

      <Card padding="p-0" className="mt-6">
        <ul className="divide-y divide-neutral-100">
          {admins.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-3 px-5 py-4 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium">{a.name || a.email}</p>
                <p className="truncate text-xs text-neutral-500">{a.email}</p>
              </div>
              {isSuperAdmin && a.id !== me.id && (
                <form action={removeAdmin} className="shrink-0">
                  <input type="hidden" name="userId" value={a.id} />
                  <ConfirmSubmitButton
                    label="ถอดสิทธิ์"
                    confirmTitle="ถอดสิทธิ์ Admin?"
                    confirmMessage={`${a.email} จะไม่มีสิทธิ์ Admin อีกต่อไป`}
                  />
                </form>
              )}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
