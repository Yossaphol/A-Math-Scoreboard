import { requireAdmin } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { unlinkGlobalPlayerAccount, deleteGlobalPlayerAccount } from "@/lib/actions/global-players";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmSubmitButton } from "@/components/ui/ConfirmSubmitButton";
import { RenamePlayerForm } from "@/components/admin/RenamePlayerForm";
import { inputClass } from "@/components/ui/styles";

export default async function GlobalPlayersPage(props: PageProps<"/admin/players">) {
  await requireAdmin();
  const { q } = await props.searchParams;
  const query = typeof q === "string" ? q.trim() : "";

  const players = await prisma.globalPlayer.findMany({
    where: query
      ? {
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { nickname: { contains: query, mode: "insensitive" } },
          ],
        }
      : undefined,
    include: { user: true, _count: { select: { tournamentPlayers: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <PageHeader title="Global Players" />

      <form className="mb-6 max-w-sm">
        <input type="search" name="q" defaultValue={query} placeholder="ค้นหาผู้เล่น..." className={inputClass} />
      </form>

      {players.length === 0 ? (
        <EmptyState title="ไม่พบผู้เล่น" />
      ) : (
        <Card padding="p-0" className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200/70 text-left text-xs text-neutral-500">
                <th className="py-3 pl-5 pr-3">Global Player ID</th>
                <th className="py-3 pr-3">Name</th>
                <th className="py-3 pr-3">Linked Google Account</th>
                <th className="py-3 pr-3 text-right">Tournaments</th>
                <th className="py-3 pr-5"></th>
              </tr>
            </thead>
            <tbody>
              {players.map((p) => (
                <tr key={p.id} className="border-b border-neutral-100 last:border-0">
                  <td className="py-3 pl-5 pr-3 text-xs text-neutral-400">{p.id}</td>
                  <td className="py-3 pr-3">
                    <RenamePlayerForm globalPlayerId={p.id} name={p.name} nickname={p.nickname} />
                  </td>
                  <td className="py-3 pr-3 text-xs text-neutral-500">{p.user?.email ?? "—"}</td>
                  <td className="py-3 pr-3 text-right">{p._count.tournamentPlayers}</td>
                  <td className="py-3 pr-5">
                    {p.user && (
                      <div className="flex justify-end gap-2">
                        <form action={unlinkGlobalPlayerAccount}>
                          <input type="hidden" name="globalPlayerId" value={p.id} />
                          <ConfirmSubmitButton
                            label="ยกเลิกผูกบัญชี"
                            confirmTitle="ยกเลิกการผูกบัญชี Google?"
                            confirmMessage={`${p.user.email} จะไม่ผูกกับผู้เล่น "${p.name}" อีกต่อไป (บัญชียังใช้ Login ได้ตามปกติ)`}
                            variant="secondary"
                          />
                        </form>
                        <form action={deleteGlobalPlayerAccount}>
                          <input type="hidden" name="globalPlayerId" value={p.id} />
                          <ConfirmSubmitButton
                            label="ลบบัญชี"
                            confirmTitle="ลบบัญชีผู้เล่นนี้?"
                            confirmMessage={`บัญชี ${p.user.email} จะถูกลบถาวร (ต้อง Login ใหม่หากจะใช้งานอีก) ทำได้เฉพาะบัญชีที่ยังไม่เคยเป็น Staff หรือสร้าง Tournament`}
                          />
                        </form>
                      </div>
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
