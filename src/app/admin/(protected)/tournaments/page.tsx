import Link from "next/link";
import { requireAdmin } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { TOURNAMENT_STATUS_BADGE } from "@/lib/status-labels";
import type { Tournament } from "@/generated/prisma/client";

type TournamentRow = Tournament & { _count: { players: number; staff: number } };

export default async function AllTournamentsPage() {
  await requireAdmin();

  const tournaments = await prisma.tournament.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { players: true, staff: true } } },
  });

  const active = tournaments.filter((t) => t.status !== "COMPLETED");
  const completed = tournaments.filter((t) => t.status === "COMPLETED");

  return (
    <div>
      <PageHeader
        title="All Tournaments"
        actions={<LinkButton href="/admin/tournaments/new">+ Create Tournament</LinkButton>}
      />

      {tournaments.length === 0 ? (
        <EmptyState
          title="ยังไม่มี Tournament"
          action={<LinkButton href="/admin/tournaments/new">+ Create Tournament</LinkButton>}
        />
      ) : (
        <div className="space-y-4">
          {active.length === 0 ? (
            <EmptyState title="ไม่มี Tournament ที่กำลังดำเนินการ" />
          ) : (
            <Card padding="p-0">
              <ul className="divide-y divide-neutral-100">
                {active.map((t) => (
                  <TournamentListItem key={t.id} tournament={t} />
                ))}
              </ul>
            </Card>
          )}

          {completed.length > 0 && (
            <details className="group">
              <summary className="cursor-pointer list-none text-xs font-medium text-neutral-500 hover:text-neutral-900">
                <span className="inline-flex items-center gap-1">
                  <span className="transition-transform group-open:rotate-90">▸</span>
                  แข่งจบแล้ว ({completed.length})
                </span>
              </summary>
              <Card padding="p-0" className="mt-2">
                <ul className="divide-y divide-neutral-100">
                  {completed.map((t) => (
                    <TournamentListItem key={t.id} tournament={t} />
                  ))}
                </ul>
              </Card>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

function TournamentListItem({ tournament: t }: { tournament: TournamentRow }) {
  const status = TOURNAMENT_STATUS_BADGE[t.status];
  return (
    <li>
      <Link
        href={`/admin/tournaments/${t.id}`}
        className="flex items-center justify-between gap-3 px-5 py-4 text-sm transition-colors hover:bg-black/[0.02]"
      >
        <div className="min-w-0">
          <p className="truncate font-medium">{t.name}</p>
          <p className="truncate text-xs text-neutral-500">
            {t._count.players} players · {t._count.staff} staff · {t.mode}
          </p>
        </div>
        <Badge variant={status.variant} className="shrink-0">
          {status.label}
        </Badge>
      </Link>
    </li>
  );
}
