import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { MATCH_STATUS_BADGE } from "@/lib/status-labels";
import type { MatchSearchKey } from "@/lib/match-search";
import type { MatchStatus } from "@/generated/prisma/enums";
import { TableTile } from "./TableTile";
import { AdminScoreForm } from "./AdminScoreForm";

type Player = { id: string; tournamentPlayerNo: number; globalPlayer: { name: string; nickname: string | null } };

export type AdminMatch = {
  id: string;
  status: MatchStatus;
  isBye: boolean;
  player1Id: string;
  player2Id: string | null;
  byeClaimedById: string | null;
  finalPlayer1Score: number | null;
  finalPlayer2Score: number | null;
  editedByAdminId: string | null;
  table: { tableNumber: number } | null;
  player1: Player;
  player2: Player | null;
  submissions: { side: "PLAYER1" | "PLAYER2"; player1Score: number; player2Score: number }[];
};

/** What the round's search box matches this card against. */
export function adminMatchSearchKey(m: AdminMatch): MatchSearchKey {
  return {
    table: m.table?.tableNumber ?? null,
    players: [m.player1, ...(m.player2 ? [m.player2] : [])].map((p) => ({
      no: p.tournamentPlayerNo,
      name: p.globalPlayer.name,
      nickname: p.globalPlayer.nickname,
    })),
  };
}

export function needsAttention(m: { status: string; byeClaimedById: string | null; player2Id: string | null }) {
  return m.status === "CONFLICT" || (!!m.byeClaimedById && !!m.player2Id && m.status !== "CONFIRMED");
}

/**
 * One match as Admin/Staff see it during a round (Round page and the "กรอกผล" page): table
 * number up front, players with their numbers, status, and the score form — each side's
 * report with a one-tap "use this" when they disagree. `extra` slots in round-page tools
 * such as the no-show claim banner.
 */
export function AdminMatchCard({
  match: m,
  roundNumber,
  extra,
}: {
  match: AdminMatch;
  roundNumber: number;
  extra?: React.ReactNode;
}) {
  const status = MATCH_STATUS_BADGE[m.status];
  const p1Sub = m.submissions.find((s) => s.side === "PLAYER1");
  const p2Sub = m.submissions.find((s) => s.side === "PLAYER2");
  const p1Name = m.player1.globalPlayer.name;
  const p2Name = m.player2?.globalPlayer.name ?? "";
  const where = `Round ${roundNumber}${m.table ? ` · Table ${m.table.tableNumber}` : ""}`;
  const reports =
    m.status === "CONFLICT"
      ? [
          ...(p1Sub ? [{ byName: p1Name, player1Score: p1Sub.player1Score, player2Score: p1Sub.player2Score }] : []),
          ...(p2Sub ? [{ byName: p2Name, player1Score: p2Sub.player1Score, player2Score: p2Sub.player2Score }] : []),
        ]
      : [];
  // Half-reported: start from the one report there is. In a conflict, make them pick one.
  const single = m.status !== "CONFLICT" ? (p1Sub ?? p2Sub) : undefined;

  const playerLabel = (p: Player) => (
    <>
      {p.globalPlayer.name}
      {p.globalPlayer.nickname && <span className="font-normal text-neutral-500"> ({p.globalPlayer.nickname})</span>}
      <span className="ml-1 text-xs font-normal text-neutral-400">#{p.tournamentPlayerNo}</span>
    </>
  );

  return (
    <li id={`match-${m.id}`} className="scroll-mt-6">
      <Card padding="p-4" className={needsAttention(m) ? "border-red-200 !bg-red-50/40" : ""}>
        <div className="flex gap-4">
          <TableTile tableNumber={m.isBye || !m.player2 ? null : (m.table?.tableNumber ?? null)} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="min-w-0 break-words font-medium">
                {playerLabel(m.player1)}
                {m.player2 ? (
                  <>
                    <span className="mx-1.5 font-normal text-neutral-400">vs</span>
                    {playerLabel(m.player2)}
                  </>
                ) : (
                  " (Bye)"
                )}
              </span>
              <Badge variant={status.variant}>{status.label}</Badge>
            </div>

            {m.status === "CONFIRMED" && !m.isBye && (
              <p className="mt-1.5 text-sm tabular-nums text-neutral-600">
                ผล: <b className="text-neutral-900">{m.finalPlayer1Score}</b> –{" "}
                <b className="text-neutral-900">{m.finalPlayer2Score}</b>
                {m.editedByAdminId && <span className="text-xs text-neutral-500"> (แก้ไขโดย Admin/Staff)</span>}
              </p>
            )}

            {extra}

            {!m.isBye && m.player2 && m.status !== "CONFIRMED" && (
              <div className="mt-3">
                <AdminScoreForm
                  key={`${m.status}-${p1Sub?.player1Score}-${p1Sub?.player2Score}-${p2Sub?.player1Score}-${p2Sub?.player2Score}`}
                  matchId={m.id}
                  where={where}
                  player1Name={p1Name}
                  player2Name={p2Name}
                  initial={single}
                  reports={reports}
                />
              </div>
            )}
            {!m.isBye && m.player2 && m.status === "CONFIRMED" && (
              <details className="group mt-2">
                <summary className="cursor-pointer text-xs text-neutral-500 group-open:mb-2">แก้ไขผล</summary>
                <AdminScoreForm
                  matchId={m.id}
                  where={where}
                  player1Name={p1Name}
                  player2Name={p2Name}
                  initial={{ player1Score: m.finalPlayer1Score ?? 0, player2Score: m.finalPlayer2Score ?? 0 }}
                  submitLabel="บันทึก"
                  subtle
                />
              </details>
            )}
          </div>
        </div>
      </Card>
    </li>
  );
}
