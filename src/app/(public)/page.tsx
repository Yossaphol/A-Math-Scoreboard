import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { inputClass } from "@/components/ui/styles";
import { TOURNAMENT_STATUS_BADGE } from "@/lib/status-labels";

export default async function HomePage({ searchParams }: PageProps<"/">) {
  const { q } = await searchParams;
  const query = typeof q === "string" ? q.trim() : "";

  // Public listing only surfaces what's actually relevant to a visitor right now — a
  // finished tournament's own pages stay reachable by direct link, it just doesn't clutter
  // this list.
  const tournaments = await prisma.tournament.findMany({
    where: {
      status: { in: ["ONGOING", "UPCOMING"] },
      ...(query ? { name: { contains: query, mode: "insensitive" } } : {}),
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: { _count: { select: { players: true } } },
  });

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-2xl font-semibold text-neutral-900">Tournaments</h1>
      <p className="mt-1 text-sm text-neutral-500">
        ดูการจับคู่ คะแนน และผลการแข่งขันได้ทันทีโดยไม่ต้อง Login
      </p>

      <form className="mt-6" action="/">
        <input type="search" name="q" defaultValue={query} placeholder="ค้นหา Tournament..." className={inputClass} />
      </form>

      {tournaments.length === 0 ? (
        <div className="mt-6">
          <EmptyState title="ไม่พบ Tournament" />
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {tournaments.map((t) => {
            const status = TOURNAMENT_STATUS_BADGE[t.status];
            return (
              <Link key={t.id} href={`/t/${t.id}`} className="block">
                <Card
                  padding="p-5"
                  className="flex items-center justify-between gap-3 transition-shadow hover:shadow-md"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-neutral-900">{t.name}</p>
                    <p className="truncate text-xs text-neutral-500">
                      {t._count.players} players · {t.mode === "PRACTICE" ? "Practice" : "Competition"}
                    </p>
                  </div>
                  <Badge variant={status.variant} className="shrink-0">
                    {status.label}
                  </Badge>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
