import { getScoreboard } from "@/lib/scoreboard";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";

/** Shared body of the /t/[id]/scoreboard and /practice/[id]/scoreboard pages. */
export async function ScoreboardTable({ tournamentId }: { tournamentId: string }) {
  const rows = await getScoreboard(tournamentId);

  if (rows.length === 0) return <EmptyState title="ยังไม่มีผู้เล่น" />;

  return (
    <div className="relative">
      <Card padding="p-0" className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-neutral-200/70 text-left text-xs text-neutral-500">
              <th className="sticky left-0 z-10 max-w-[220px] bg-white py-4 pl-5 pr-4">ผู้เล่น</th>
              <th className="px-4 py-4 text-right">Points</th>
              <th className="px-4 py-4 text-center">W</th>
              <th className="px-4 py-4 text-center">T</th>
              <th className="px-4 py-4 text-center">L</th>
              <th className="px-4 py-4 text-right">คะแนนที่ทำได้</th>
              <th className="px-4 py-4 text-right">คะแนนคู่ต่อสู้</th>
              <th className="py-4 pl-4 pr-5 text-right">Diff</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.tournamentPlayerId} className="border-b border-neutral-100 last:border-0">
                <td className="sticky left-0 z-10 max-w-[220px] truncate bg-white py-4 pl-5 pr-4">
                  <span className="inline-block w-5 text-neutral-400">{r.rank}</span>
                  <span className="font-medium text-neutral-900">{r.name}</span>
                  <span className="ml-1 text-xs text-neutral-400">(#{r.tournamentPlayerNo})</span>
                  {r.status === "WITHDRAWN" && (
                    <Badge variant="neutral" className="ml-2">
                      Withdrawn
                    </Badge>
                  )}
                </td>
                <td className="px-4 py-4 text-right text-base font-semibold text-neutral-900">{r.points}</td>
                <td className="px-4 py-4 text-center text-neutral-600">{r.wins}</td>
                <td className="px-4 py-4 text-center text-neutral-600">{r.ties}</td>
                <td className="px-4 py-4 text-center text-neutral-600">{r.losses}</td>
                <td className="px-4 py-4 text-right text-neutral-600">{r.ownScoreTotal}</td>
                <td className="px-4 py-4 text-right text-neutral-600">{r.opponentScoreTotal}</td>
                <td className="py-4 pl-4 pr-5 text-right font-medium text-neutral-900">
                  {r.cumulativeDiff > 0 ? `+${r.cumulativeDiff}` : r.cumulativeDiff}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      {/* Hints that there's more to the right on narrow screens — the table itself already
          scrolls (overflow-x-auto above), this just makes that discoverable at a glance. */}
      <div className="pointer-events-none absolute inset-y-0 right-0 w-10 rounded-r-2xl bg-gradient-to-l from-white/80 to-transparent md:hidden" />
    </div>
  );
}
