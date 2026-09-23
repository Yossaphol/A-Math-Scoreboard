import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { LinkRow } from "@/components/ui/LinkRow";
import { ROUND_STATUS_BADGE } from "@/lib/status-labels";

export default async function AdminRoundsPage(props: PageProps<"/admin/tournaments/[id]/rounds">) {
  const { id } = await props.params;
  const rounds = await prisma.round.findMany({
    where: { tournamentId: id },
    orderBy: { roundNumber: "asc" },
    include: { _count: { select: { matches: true } } },
  });

  if (rounds.length === 0) {
    return <EmptyState title="ยังไม่มี Round" />;
  }

  return (
    <Card padding="p-0" className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-neutral-200/70 text-left text-xs text-neutral-500">
            <th className="py-3 pl-5 pr-3">Round</th>
            <th className="py-3 pr-3">Pairing Method</th>
            <th className="py-3 pr-3">Maximum Score</th>
            <th className="py-3 pr-3">Matches</th>
            <th className="py-3 pr-5">Status</th>
          </tr>
        </thead>
        <tbody>
          {rounds.map((r) => {
            const status = ROUND_STATUS_BADGE[r.status];
            return (
              <LinkRow
                key={r.id}
                href={`/admin/tournaments/${id}/rounds/${r.id}`}
                className="border-b border-neutral-100 last:border-0"
              >
                <td className="py-3 pl-5 pr-3">
                  <Link
                    href={`/admin/tournaments/${id}/rounds/${r.id}`}
                    className="font-medium hover:underline"
                  >
                    {r.roundNumber}
                  </Link>
                </td>
                <td className="py-3 pr-3">{r.pairingMethod ?? "—"}</td>
                <td className="py-3 pr-3">{r.maximumScoreEnabled ? r.maximumScore : "Off"}</td>
                <td className="py-3 pr-3">{r._count.matches}</td>
                <td className="py-3 pr-5">
                  <Badge variant={status.variant}>{status.label}</Badge>
                </td>
              </LinkRow>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}
