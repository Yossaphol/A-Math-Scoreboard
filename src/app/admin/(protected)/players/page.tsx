import { requireAdmin } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
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
                <th className="py-3 pr-5 text-right">Tournaments</th>
              </tr>
            </thead>
            <tbody>
              {players.map((p) => (
                <tr key={p.id} className="border-b border-neutral-100 last:border-0">
                  <td className="py-3 pl-5 pr-3 text-xs text-neutral-400">{p.id}</td>
                  <td className="py-3 pr-3">
                    {p.name}
                    {p.nickname && <span className="ml-2 text-xs text-neutral-500">{p.nickname}</span>}
                  </td>
                  <td className="py-3 pr-3 text-xs text-neutral-500">{p.user?.email ?? "—"}</td>
                  <td className="py-3 pr-5 text-right">{p._count.tournamentPlayers}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
