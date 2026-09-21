import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ROUND_STATUS_BADGE } from "@/lib/status-labels";

export default async function RoundsPage(props: PageProps<"/t/[id]/rounds">) {
  const { id } = await props.params;

  // Preview rounds aren't real yet — never show them publicly (spec §9/§10).
  const rounds = await prisma.round.findMany({
    where: { tournamentId: id, status: { in: ["CONFIRMED", "COMPLETED"] } },
    orderBy: { roundNumber: "asc" },
    include: { _count: { select: { matches: true } } },
  });

  if (rounds.length === 0) return <EmptyState title="ยังไม่มี Round" />;

  return (
    <div className="space-y-2">
      {rounds.map((r) => {
        const status = ROUND_STATUS_BADGE[r.status];
        return (
          <Link key={r.id} href={`/t/${id}/rounds/${r.id}`} className="block">
            <Card padding="p-4" className="flex items-center justify-between transition-shadow hover:shadow-md">
              <span className="text-sm font-medium">Round {r.roundNumber}</span>
              <span className="flex items-center gap-2 text-xs text-neutral-500">
                {r._count.matches} matches
                <Badge variant={status.variant}>{status.label}</Badge>
              </span>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
