import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { inputClass } from "@/components/ui/styles";
import { TOURNAMENT_STATUS_BADGE } from "@/lib/status-labels";
import { publicTournamentPath, publicTournamentListPath } from "@/lib/tournament-path";
import type { TournamentMode } from "@/generated/prisma/enums";

const COPY: Record<TournamentMode, { title: string; subtitle: string }> = {
  COMPETITION: {
    title: "Tournaments",
    subtitle: "ดูการจับคู่ คะแนน และผลการแข่งขันได้ทันทีโดยไม่ต้อง Login",
  },
  PRACTICE: {
    title: "Practice",
    subtitle: "ดูการจับคู่ คะแนน และประวัติการฝึกซ้อมได้ทันทีโดยไม่ต้อง Login",
  },
};

const RECENTLY_COMPLETED_DAYS = 7;

// Server-rendered per request, so reading the clock here is the point, not a purity bug.
function recentlyCompletedCutoff() {
  return new Date(Date.now() - RECENTLY_COMPLETED_DAYS * 24 * 60 * 60 * 1000);
}

/** Shared body of the "/" (Competition) and "/practice" (Practice) tournament list
 * pages — same search + card list + empty state, just filtered by mode. */
export async function TournamentListPage({ mode, query }: { mode: TournamentMode; query: string }) {
  const copy = COPY[mode];
  const basePath = publicTournamentListPath(mode);

  // Public listing only surfaces what's actually relevant to a visitor right now: upcoming and
  // ongoing tournaments, plus ones finished in the last RECENTLY_COMPLETED_DAYS — a Tournament
  // can complete on its own the moment its last result is entered, which is exactly when
  // players come looking for the final standings. Older finished tournaments stay reachable by
  // direct link, they just don't clutter this list. updatedAt stands in for "completed at"
  // (completing is the last write a finished Tournament normally gets).
  const recentlyCompletedSince = recentlyCompletedCutoff();
  const tournaments = await prisma.tournament.findMany({
    where: {
      mode,
      OR: [
        { status: { in: ["ONGOING", "UPCOMING"] } },
        { status: "COMPLETED", updatedAt: { gte: recentlyCompletedSince } },
      ],
      ...(query ? { name: { contains: query, mode: "insensitive" } } : {}),
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: { _count: { select: { players: true } } },
  });

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-2xl font-semibold text-neutral-900">{copy.title}</h1>
      <p className="mt-1 text-sm text-neutral-500">{copy.subtitle}</p>

      <form className="mt-6" action={basePath}>
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
              <Link key={t.id} href={publicTournamentPath({ id: t.id, mode: t.mode })} className="block">
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
