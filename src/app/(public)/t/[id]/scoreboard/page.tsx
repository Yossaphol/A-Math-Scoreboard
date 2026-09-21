import { getScoreboard } from "@/lib/scoreboard";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";

export default async function ScoreboardPage(props: PageProps<"/t/[id]/scoreboard">) {
  const { id } = await props.params;
  const rows = await getScoreboard(id);

  if (rows.length === 0) return <EmptyState title="ยังไม่มีผู้เล่น" />;

  return (
    <Card padding="p-0" className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-neutral-200/70 text-left text-xs text-neutral-500">
            <th className="py-3 pl-5 pr-3">#</th>
            <th className="py-3 pr-3">Name</th>
            <th className="py-3 pr-3 text-right">Points</th>
            <th className="py-3 pr-3 text-center">W</th>
            <th className="py-3 pr-3 text-center">T</th>
            <th className="py-3 pr-3 text-center">L</th>
            <th className="py-3 pr-3 text-right">คะแนนที่ทำได้</th>
            <th className="py-3 pr-3 text-right">คะแนนคู่ต่อสู้</th>
            <th className="py-3 pr-5 text-right">Diff</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.tournamentPlayerId} className="border-b border-neutral-100 last:border-0">
              <td className="py-3 pl-5 pr-3 text-neutral-500">{r.rank}</td>
              <td className="py-3 pr-3">
                {r.name}
                <span className="text-neutral-400">(#{r.tournamentPlayerNo})</span>
                {r.status === "WITHDRAWN" && (
                  <Badge variant="neutral" className="ml-2">
                    Withdrawn
                  </Badge>
                )}
              </td>
              <td className="py-3 pr-3 text-right font-medium">{r.points}</td>
              <td className="py-3 pr-3 text-center">{r.wins}</td>
              <td className="py-3 pr-3 text-center">{r.ties}</td>
              <td className="py-3 pr-3 text-center">{r.losses}</td>
              <td className="py-3 pr-3 text-right">{r.ownScoreTotal}</td>
              <td className="py-3 pr-3 text-right">{r.opponentScoreTotal}</td>
              <td className="py-3 pr-5 text-right">
                {r.cumulativeDiff > 0 ? `+${r.cumulativeDiff}` : r.cumulativeDiff}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
