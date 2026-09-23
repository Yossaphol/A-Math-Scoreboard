import { prisma } from "@/lib/prisma";
import { removePlayerFromTournament, withdrawPlayer, reactivatePlayer } from "@/lib/actions/players";
import { Button } from "@/components/ui/Button";
import { ConfirmSubmitButton } from "@/components/ui/ConfirmSubmitButton";
import { Badge } from "@/components/ui/Badge";
import { AddPlayerModal, ImportPlayersModal } from "@/components/admin/TournamentPlayerModals";
import { ExpandablePlayerRow } from "@/components/admin/ExpandablePlayerRow";
import { PlayersTable } from "@/components/admin/PlayersTable";
import { cappedDiff } from "@/lib/match/diff";
import { getMaxScoreConfig } from "@/lib/match/max-score-config";
import { BYE_SCORE } from "@/lib/match/bye";
import { MATCH_OUTCOME_BADGE, MATCH_STATUS_BADGE, PLAYER_STATUS_BADGE } from "@/lib/status-labels";
import type { MatchOutcome, MatchStatus } from "@/generated/prisma/enums";

type HistoryEntry = {
  matchId: string;
  roundNumber: number | null;
  createdAt: Date;
  tableNumber: number | null;
  opponent: string | null; // null => Bye
  myScore: number | null;
  oppScore: number | null;
  // Spread as counted for standings (capped by the round's Maximum Score) vs. the real one.
  diff: number | null;
  rawDiff: number | null;
  result: MatchOutcome | null;
  status: MatchStatus;
  // Late-arrival Bye: which side didn't show up (null for a game actually played).
  absent: "self" | "opponent" | null;
  byeClaimPending: boolean;
};

export default async function TournamentPlayersPage(
  props: PageProps<"/admin/tournaments/[id]/players">
) {
  const { id } = await props.params;

  const [tournament, players, matches] = await Promise.all([
    prisma.tournament.findUniqueOrThrow({ where: { id } }),
    prisma.tournamentPlayer.findMany({
      where: { tournamentId: id },
      include: { globalPlayer: true },
      orderBy: { tournamentPlayerNo: "asc" },
    }),
    prisma.match.findMany({
      where: { tournamentId: id },
      include: {
        round: true,
        table: true,
        player1: { include: { globalPlayer: true } },
        player2: { include: { globalPlayer: true } },
      },
    }),
  ]);

  // Each player's games in this Tournament, from both sides of the Match, ordered by Round.
  // A self-service ad-hoc match (Practice mode, no staff Round) has round: null — those sort
  // after every numbered round, by when they were played.
  const historyByPlayer = new Map<string, HistoryEntry[]>();
  function pushEntry(playerId: string, entry: HistoryEntry) {
    const list = historyByPlayer.get(playerId) ?? [];
    list.push(entry);
    historyByPlayer.set(playerId, list);
  }
  for (const m of matches) {
    const base = {
      matchId: m.id,
      roundNumber: m.round?.roundNumber ?? null,
      createdAt: m.createdAt,
      tableNumber: m.table?.tableNumber ?? null,
      status: m.status,
      byeClaimPending: m.byeClaimedById != null && m.status !== "CONFIRMED",
    };

    // Odd-player-count Bye (spec §19): counted as W 100-0, +100 — same as the Scoreboard.
    if (m.isBye || !m.player2Id || !m.player2) {
      const done = m.status === "BYE" || m.status === "CONFIRMED";
      pushEntry(m.player1Id, {
        ...base,
        opponent: null,
        myScore: done ? BYE_SCORE : null,
        oppScore: done ? 0 : null,
        diff: done ? BYE_SCORE : null,
        rawDiff: done ? BYE_SCORE : null,
        result: done ? "WIN" : null,
        absent: null,
      });
      continue;
    }

    const cap = getMaxScoreConfig(m);
    const scored = m.finalPlayer1Score != null && m.finalPlayer2Score != null;
    const p1 = m.finalPlayer1Score ?? 0;
    const p2 = m.finalPlayer2Score ?? 0;
    // A late-arrival Bye is stored as 100-0 and never capped — no game was actually played.
    const diffFor = (own: number, opp: number) =>
      m.forfeitPlayerId ? own - opp : cappedDiff(own, opp, cap.enabled, cap.max);
    const absentFor = (playerId: string) =>
      !m.forfeitPlayerId ? null : m.forfeitPlayerId === playerId ? "self" : "opponent";

    pushEntry(m.player1Id, {
      ...base,
      opponent: m.player2.globalPlayer.name,
      myScore: m.finalPlayer1Score,
      oppScore: m.finalPlayer2Score,
      diff: scored ? diffFor(p1, p2) : null,
      rawDiff: scored ? p1 - p2 : null,
      result: m.player1Result,
      absent: absentFor(m.player1Id),
    });
    pushEntry(m.player2Id, {
      ...base,
      opponent: m.player1.globalPlayer.name,
      myScore: m.finalPlayer2Score,
      oppScore: m.finalPlayer1Score,
      diff: scored ? diffFor(p2, p1) : null,
      rawDiff: scored ? p2 - p1 : null,
      result: m.player2Result,
      absent: absentFor(m.player2Id),
    });
  }
  for (const list of historyByPlayer.values()) {
    list.sort((a, b) => {
      if (a.roundNumber != null && b.roundNumber != null) return a.roundNumber - b.roundNumber;
      if (a.roundNumber != null) return -1;
      if (b.roundNumber != null) return 1;
      return a.createdAt.getTime() - b.createdAt.getTime();
    });
  }

  const header = (
    <tr className="border-b border-neutral-200/70 text-left text-xs text-neutral-500">
      <th className="w-8 py-3 pl-4" aria-label="ประวัติ" />
      <th className="py-3 pr-3">#</th>
      <th className="py-3 pr-3">Name</th>
      <th className="py-3 pr-3">Global Player ID</th>
      <th className="py-3 pr-3">Status</th>
      <th className="py-3 pr-5 text-right">Actions</th>
    </tr>
  );

  const rows = players.map((p) => {
    const status = PLAYER_STATUS_BADGE[p.status];
    const history = historyByPlayer.get(p.id) ?? [];
    return {
      id: p.id,
      searchText: [p.globalPlayer.name, p.globalPlayer.nickname, `#${p.tournamentPlayerNo}`, `#${p.globalPlayerId}`]
        .filter(Boolean)
        .join(" ")
        .toLowerCase(),
      node: (
        <ExpandablePlayerRow colSpan={5} history={<PlayerHistory history={history} />}>
          <td className="py-3 pr-3 text-neutral-500">{p.tournamentPlayerNo}</td>
          <td className="py-3 pr-3">
            {p.globalPlayer.name}
            {p.globalPlayer.nickname && (
              <span className="ml-2 text-xs text-neutral-500">{p.globalPlayer.nickname}</span>
            )}
          </td>
          <td className="py-3 pr-3 text-xs text-neutral-400">#{p.globalPlayerId}</td>
          <td className="py-3 pr-3">
            <Badge variant={status.variant}>{status.label}</Badge>
          </td>
          <td className="py-3 pr-5 text-right" data-no-row-toggle>
            <div className="flex justify-end gap-2">
              {p.status === "ACTIVE" ? (
                <form action={withdrawPlayer}>
                  <input type="hidden" name="tournamentPlayerId" value={p.id} />
                  <ConfirmSubmitButton
                    label="Withdraw"
                    variant="secondary"
                    confirmTitle="Withdraw ผู้เล่น?"
                    confirmMessage={`${p.globalPlayer.name} จะไม่ถูกจับคู่ใน Round ถัดไป แต่ประวัติเดิมยังอยู่ (Withdraw ≠ Delete)`}
                  />
                </form>
              ) : (
                <form action={reactivatePlayer}>
                  <input type="hidden" name="tournamentPlayerId" value={p.id} />
                  <Button type="submit" variant="secondary" size="sm">
                    Reactivate
                  </Button>
                </form>
              )}
              {tournament.status === "UPCOMING" && (
                <form action={removePlayerFromTournament}>
                  <input type="hidden" name="tournamentPlayerId" value={p.id} />
                  <ConfirmSubmitButton
                    label="Remove"
                    confirmTitle="ลบผู้เล่นออกจาก Tournament?"
                    confirmMessage={`${p.globalPlayer.name} จะถูกลบออกทั้งหมด — ใช้เมื่อ Import ผิดหรือผู้เล่นไม่เข้าร่วมเท่านั้น`}
                  />
                </form>
              )}
            </div>
          </td>
        </ExpandablePlayerRow>
      ),
    };
  });

  return (
    <PlayersTable
      header={header}
      rows={rows}
      actions={
        <>
          <AddPlayerModal tournamentId={id} />
          <ImportPlayersModal tournamentId={id} />
        </>
      }
    />
  );
}

function signed(n: number) {
  return n > 0 ? `+${n}` : String(n);
}

function PlayerHistory({ history }: { history: HistoryEntry[] }) {
  if (history.length === 0) {
    return <p className="py-3 text-center text-xs text-neutral-500">ยังไม่มีประวัติการเล่นใน Tournament นี้</p>;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-neutral-200/70 bg-white/70">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-neutral-200/70 text-left text-neutral-500">
            <th className="py-2 pl-4 pr-3 font-medium">Round</th>
            <th className="py-2 pr-3 font-medium">โต๊ะ</th>
            <th className="py-2 pr-3 text-center font-medium">ผล</th>
            <th className="py-2 pr-3 font-medium">คู่แข่ง</th>
            <th className="py-2 pr-3 text-right font-medium">คะแนน</th>
            <th className="py-2 pr-3 text-right font-medium">ผลต่าง</th>
            <th className="py-2 pr-4 text-right font-medium">สถานะ</th>
          </tr>
        </thead>
        <tbody>
          {history.map((h) => {
            const outcome = h.result ? MATCH_OUTCOME_BADGE[h.result] : null;
            const matchStatus = MATCH_STATUS_BADGE[h.status];
            const capped = h.diff != null && h.rawDiff != null && h.diff !== h.rawDiff;
            return (
              <tr key={h.matchId} className="border-b border-neutral-100 last:border-0">
                <td className="py-2 pl-4 pr-3 text-neutral-500">
                  {h.roundNumber != null ? `R${h.roundNumber}` : "ฝึกซ้อม"}
                </td>
                <td className="py-2 pr-3 text-neutral-500">{h.tableNumber ?? "—"}</td>
                <td className="py-2 pr-3 text-center">
                  {outcome ? <Badge variant={outcome.variant}>{outcome.label}</Badge> : "—"}
                </td>
                <td className="py-2 pr-3">
                  {h.opponent ?? "Bye"}
                  {h.absent === "opponent" && <span className="ml-1.5 text-neutral-400">(ไม่มา)</span>}
                  {h.absent === "self" && <span className="ml-1.5 text-neutral-400">· ผู้เล่นนี้ไม่มา</span>}
                </td>
                <td className="py-2 pr-3 text-right tabular-nums">
                  {h.myScore != null && h.oppScore != null ? `${h.myScore} - ${h.oppScore}` : "—"}
                </td>
                <td className="py-2 pr-3 text-right font-medium tabular-nums">
                  {h.diff == null ? (
                    "—"
                  ) : (
                    <>
                      {signed(h.diff)}
                      {capped && (
                        <span
                          className="ml-1 font-normal text-neutral-400"
                          title="เกิน Maximum Score ของ Round นี้ — ในวงเล็บคือผลต่างจริง"
                        >
                          ({signed(h.rawDiff!)})
                        </span>
                      )}
                    </>
                  )}
                </td>
                <td className="py-2 pr-4 text-right">
                  {h.absent ? (
                    <Badge variant="info">Bye (มาสาย)</Badge>
                  ) : h.byeClaimPending ? (
                    <Badge variant="warning">รออนุมัติ Bye</Badge>
                  ) : (
                    <Badge variant={matchStatus.variant}>{matchStatus.label}</Badge>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
