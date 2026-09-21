import { getScoreboard } from "@/lib/scoreboard";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { inputClass } from "@/components/ui/styles";

export default async function PublicPlayersPage(props: PageProps<"/t/[id]/players">) {
  const { id } = await props.params;
  const { q } = await props.searchParams;
  const query = typeof q === "string" ? q.trim() : "";

  const rows = await getScoreboard(id);
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
                <th className="py-3 pl-5 pr-3">#</th>
                <th className="py-3 pr-3">Name</th>
                <th className="py-3 pr-3 text-center">W</th>
                <th className="py-3 pr-3 text-center">T</th>
                <th className="py-3 pr-3 text-center">L</th>
                <th className="py-3 pr-5 text-right">ผลต่างสะสม</th>
              </tr>
            </thead>
            <tbody>
              {players.map((p) => (
                <tr key={p.tournamentPlayerId} className="border-b border-neutral-100 last:border-0">
                  <td className="py-3 pl-5 pr-3 text-neutral-500">{p.tournamentPlayerNo}</td>
                  <td className="py-3 pr-3">
                    <p className="font-medium">{p.name}</p>
                    {p.nickname && <p className="text-xs text-neutral-500">{p.nickname}</p>}
                    {p.status === "WITHDRAWN" && (
                      <Badge variant="neutral" className="mt-1">
                        Withdrawn
                      </Badge>
                    )}
                  </td>
                  <td className="py-3 pr-3 text-center">{p.wins}</td>
                  <td className="py-3 pr-3 text-center">{p.ties}</td>
                  <td className="py-3 pr-3 text-center">{p.losses}</td>
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
