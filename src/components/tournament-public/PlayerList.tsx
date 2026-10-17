import { getScoreboard } from "@/lib/scoreboard";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { inputClass } from "@/components/ui/styles";

/** Shared body of the /t/[id]/players and /practice/[id]/players pages. */
export async function PlayerList({ tournamentId, query }: { tournamentId: string; query: string }) {
  const rows = (await getScoreboard(tournamentId)).filter((r) => r.status !== "WITHDRAWN");
  const queryLower = query.toLowerCase();
  const queryAsNumber = Number(query);
  const players = query
    ? rows.filter(
        (r) =>
          r.name.toLowerCase().includes(queryLower) ||
          r.nickname?.toLowerCase().includes(queryLower) ||
          (Number.isInteger(queryAsNumber) &&
            (r.globalPlayerId === queryAsNumber || r.tournamentPlayerNo === queryAsNumber))
      )
    : rows;

  return (
    <div>
      <form className="mb-6">
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="ค้นหาผู้เล่นด้วยชื่อ, Nickname, Global/Tournament Player ID..."
          className={inputClass}
        />
      </form>

      {players.length === 0 ? (
        <EmptyState title="ไม่พบผู้เล่น" />
      ) : (
        <Card padding="p-0" className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200/70 text-left text-xs text-neutral-500">
                <th className="py-3 pl-5 pr-3">อันดับ</th>
                <th className="py-3 pr-3">Name</th>
                <th className="py-3 pr-3 text-right">เกม</th>
                <th className="py-3 pr-3 text-right">Points</th>
                <th className="py-3 pr-3 text-center">W/T/L</th>
                <th className="py-3 pr-5 text-right">ผลต่างสะสม</th>
              </tr>
            </thead>
            <tbody>
              {players.map((p) => (
                <tr key={p.tournamentPlayerId} className="border-b border-neutral-100 last:border-0">
                  <td className="py-3 pl-5 pr-3 text-neutral-500">{p.rank ?? "–"}</td>
                  <td className="py-3 pr-3">
                    <p className="font-medium">
                      {p.name}
                      <span className="ml-1.5 text-xs font-normal text-neutral-400">
                        (#{p.tournamentPlayerNo})
                      </span>
                    </p>
                    {p.nickname && <p className="text-xs text-neutral-500">{p.nickname}</p>}
                  </td>
                  <td className="py-3 pr-3 text-right tabular-nums text-neutral-600">{p.gamesPlayed}</td>
                  <td className="py-3 pr-3 text-right font-medium">{p.points}</td>
                  <td className="whitespace-nowrap py-3 pr-3 text-center tabular-nums">
                    {p.wins}
                    <span className="mx-0.5 text-neutral-300">/</span>
                    {p.ties}
                    <span className="mx-0.5 text-neutral-300">/</span>
                    {p.losses}
                  </td>
                  <td className="py-3 pr-5 text-right font-medium">
                    {p.cumulativeDiff > 0 ? `+${p.cumulativeDiff}` : p.cumulativeDiff}
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
