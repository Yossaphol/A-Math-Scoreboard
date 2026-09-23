import { Badge } from "@/components/ui/Badge";
import type { PairResult, Standing } from "@/lib/pairing/types";

// Presentational only (no hooks) so both the server-rendered /dev/swiss cases and the client
// SwissSimulator can use it.

export type WtlRecord = { w: number; t: number; l: number };

const GROUP_TINTS = ["bg-accent/5", "bg-success/5"];

// Alternates the tint every time the points change, so each score group reads as one band —
// the unit the Swiss fold works on.
function groupTints(ranked: Standing[]): Map<string, string> {
  const tints = new Map<string, string>();
  let index = 0;
  ranked.forEach((s, i) => {
    if (i > 0 && s.points !== ranked[i - 1].points) index++;
    tints.set(s.id, GROUP_TINTS[index % GROUP_TINTS.length]);
  });
  return tints;
}

function RankChip({ rank }: { rank: number }) {
  return (
    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-md bg-neutral-900 px-1 text-[11px] font-semibold tabular-nums text-white">
      {rank}
    </span>
  );
}

function formatDiff(diff: number) {
  return diff > 0 ? `+${diff}` : String(diff);
}

export function StandingsTable({
  ranked,
  records,
}: {
  ranked: Standing[];
  records?: Map<string, WtlRecord>;
}) {
  const tints = groupTints(ranked);
  const noById = new Map(ranked.map((s) => [s.id, s.tournamentPlayerNo]));

  return (
    <div className="max-h-[32rem] overflow-auto rounded-xl border border-neutral-200/70">
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-white/95 text-neutral-500">
          <tr className="text-left">
            <th className="px-2 py-1.5 font-medium">อันดับ</th>
            <th className="px-2 py-1.5 font-medium">ผู้เล่น</th>
            {records && <th className="px-2 py-1.5 font-medium">W-T-L</th>}
            <th className="px-2 py-1.5 text-right font-medium">แต้ม</th>
            <th className="px-2 py-1.5 text-right font-medium">Diff</th>
            <th className="px-2 py-1.5 font-medium">เคยเจอ</th>
          </tr>
        </thead>
        <tbody>
          {ranked.map((s, i) => {
            const record = records?.get(s.id);
            return (
              <tr key={s.id} className={`border-t border-neutral-200/60 ${tints.get(s.id)}`}>
                <td className="px-2 py-1">
                  <RankChip rank={i + 1} />
                </td>
                <td className="px-2 py-1 font-medium text-neutral-900">
                  #{s.tournamentPlayerNo}
                  {s.hadBye && (
                    <Badge variant="info" className="ml-1.5">
                      เคยได้ Bye
                    </Badge>
                  )}
                </td>
                {records && (
                  <td className="px-2 py-1 tabular-nums text-neutral-600">
                    {record ? `${record.w}-${record.t}-${record.l}` : "0-0-0"}
                  </td>
                )}
                <td className="px-2 py-1 text-right font-semibold tabular-nums">{s.points}</td>
                <td className="px-2 py-1 text-right tabular-nums text-neutral-600">
                  {formatDiff(s.diff)}
                </td>
                <td className="px-2 py-1 text-neutral-500">
                  {[...s.opponents].map((id) => `#${noById.get(id) ?? "?"}`).join(", ") || "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function PlayerCell({ standing, rank, floated }: { standing: Standing; rank: number; floated: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <RankChip rank={rank} />
      <span className="font-medium text-neutral-900">#{standing.tournamentPlayerNo}</span>
      <span className="text-xs text-neutral-500">{standing.points} แต้ม</span>
      {floated && <Badge variant="warning">ดึงขึ้นมา</Badge>}
    </span>
  );
}

export function PairList({
  ranked,
  pairs,
  expected,
  scores,
}: {
  ranked: Standing[];
  pairs: PairResult[];
  // Organizer notation per pair ("1-3", "7-BYE"), compared against the pair at the same index.
  expected?: string[];
  // Simulated game scores per pair index (player1, player2).
  scores?: ([number, number] | null)[];
}) {
  const tints = groupTints(ranked);
  const byId = new Map(ranked.map((s) => [s.id, s]));
  const rankById = new Map(ranked.map((s, i) => [s.id, i + 1]));

  return (
    <ol className="space-y-1.5">
      {pairs.map((pair, i) => {
        const p1 = byId.get(pair.player1Id)!;
        const p2 = pair.player2Id ? byId.get(pair.player2Id)! : null;
        const label = `${p1.tournamentPlayerNo}-${p2 ? p2.tournamentPlayerNo : "BYE"}`;
        const want = expected?.[i];
        const rematch = p2 != null && p1.opponents.has(p2.id);
        const score = scores?.[i];

        return (
          <li
            key={pair.player1Id}
            className={`flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-neutral-200/60 px-3 py-2 text-sm ${tints.get(p1.id)}`}
          >
            <span className="w-10 shrink-0 text-xs text-neutral-400">คู่ {i + 1}</span>
            <PlayerCell standing={p1} rank={rankById.get(p1.id)!} floated={p2 != null && p1.points < p2.points} />
            <span className="text-xs text-neutral-400">vs</span>
            {p2 ? (
              <PlayerCell standing={p2} rank={rankById.get(p2.id)!} floated={p2.points < p1.points} />
            ) : (
              <Badge>BYE</Badge>
            )}
            {rematch && <Badge variant="danger">เคยเจอกันแล้ว</Badge>}
            {score && (
              <span className="ml-auto font-mono text-xs tabular-nums text-neutral-600">
                {score[0]} – {score[1]}
              </span>
            )}
            {want && (
              <span
                className={`ml-auto text-xs font-medium ${want === label ? "text-success" : "text-danger"}`}
              >
                {want === label ? `✓ ${label}` : `✗ ได้ ${label} · ควรเป็น ${want}`}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
