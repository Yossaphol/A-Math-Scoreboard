import { prisma } from "@/lib/prisma";
import {
  addPlayerToTournament,
  removePlayerFromTournament,
  withdrawPlayer,
  reactivatePlayer,
} from "@/lib/actions/players";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ConfirmSubmitButton } from "@/components/ui/ConfirmSubmitButton";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { inputClass } from "@/components/ui/styles";
import { AddTournamentPlayerModal, ImportPlayersModal } from "@/components/admin/TournamentPlayerModals";
import { ExpandablePlayerRow } from "@/components/admin/ExpandablePlayerRow";
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
  result: MatchOutcome | null;
  status: MatchStatus;
};

export default async function TournamentPlayersPage(
  props: PageProps<"/admin/tournaments/[id]/players">
) {
  const { id } = await props.params;
  const { playerQuery } = await props.searchParams;
  const query = typeof playerQuery === "string" ? playerQuery.trim() : "";

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
    };
    pushEntry(m.player1Id, {
      ...base,
      opponent: m.player2?.globalPlayer.name ?? null,
      myScore: m.finalPlayer1Score,
      oppScore: m.finalPlayer2Score,
      result: m.player1Result,
    });
    if (m.player2Id && m.player2) {
      pushEntry(m.player2Id, {
        ...base,
        opponent: m.player1.globalPlayer.name,
        myScore: m.finalPlayer2Score,
        oppScore: m.finalPlayer1Score,
        result: m.player2Result,
      });
    }
  }
  for (const list of historyByPlayer.values()) {
    list.sort((a, b) => {
      if (a.roundNumber != null && b.roundNumber != null) return a.roundNumber - b.roundNumber;
      if (a.roundNumber != null) return -1;
      if (b.roundNumber != null) return 1;
      return a.createdAt.getTime() - b.createdAt.getTime();
    });
  }

  const alreadyInTournament = new Set(players.map((p) => p.globalPlayerId));
  const queryAsId = Number(query);
  const searchResults = query
    ? await prisma.globalPlayer.findMany({
        where: {
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { nickname: { contains: query, mode: "insensitive" } },
            ...(Number.isInteger(queryAsId) ? [{ id: queryAsId }] : []),
          ],
        },
        take: 10,
        orderBy: { name: "asc" },
      })
    : [];

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <form className="min-w-[14rem] flex-1">
          <input type="hidden" name="tab" value="players" />
          <input
            type="search"
            name="playerQuery"
            defaultValue={query}
            placeholder="ค้นหาผู้เล่นที่มีอยู่แล้วเพื่อเพิ่มเข้า Tournament (ชื่อ, Nickname หรือ Global Player ID)..."
            className={inputClass}
          />
        </form>
        <AddTournamentPlayerModal tournamentId={id} />
        <ImportPlayersModal tournamentId={id} />
      </div>

      {query && (
        <Card padding="px-5 py-2" className="mt-3">
          <ul className="divide-y divide-neutral-100">
            {searchResults.map((gp) => {
              const already = alreadyInTournament.has(gp.id);
              return (
                <li key={gp.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <div className="min-w-0 truncate">
                    <span className="font-medium">{gp.name}</span>
                    {gp.nickname && <span className="ml-2 text-xs text-neutral-500">{gp.nickname}</span>}
                    <span className="ml-2 text-xs text-neutral-400">#{gp.id}</span>
                  </div>
                  {already ? (
                    <Badge variant="neutral" className="shrink-0">
                      อยู่ใน Tournament นี้แล้ว
                    </Badge>
                  ) : (
                    <form action={addPlayerToTournament} className="shrink-0">
                      <input type="hidden" name="tournamentId" value={id} />
                      <input type="hidden" name="globalPlayerId" value={gp.id} />
                      <Button type="submit" variant="secondary" size="sm">
                        + เพิ่มเข้า Tournament
                      </Button>
                    </form>
                  )}
                </li>
              );
            })}
            {searchResults.length === 0 && (
              <li className="py-4 text-center text-xs text-neutral-500">
                ไม่พบผู้เล่นที่ตรงกับ &quot;{query}&quot; — กด &quot;+ เพิ่มผู้เล่นใหม่&quot; เพื่อสร้างใหม่
              </li>
            )}
          </ul>
        </Card>
      )}

      <Card padding="p-0" className="mt-4 overflow-x-auto">
        {players.length === 0 ? (
          <div className="p-6">
            <EmptyState title="ยังไม่มีผู้เล่น" />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200/70 text-left text-xs text-neutral-500">
                <th className="w-8 py-3 pl-4" aria-label="ประวัติ" />
                <th className="py-3 pr-3">#</th>
                <th className="py-3 pr-3">Name</th>
                <th className="py-3 pr-3">Global Player ID</th>
                <th className="py-3 pr-3">Status</th>
                <th className="py-3 pr-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {players.map((p) => {
                const status = PLAYER_STATUS_BADGE[p.status];
                const history = historyByPlayer.get(p.id) ?? [];
                return (
                  <ExpandablePlayerRow key={p.id} colSpan={5} history={<PlayerHistory history={history} />}>
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
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
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
            <th className="py-2 pr-3 font-medium">คู่แข่ง</th>
            <th className="py-2 pr-3 text-right font-medium">คะแนน</th>
            <th className="py-2 pr-3 text-center font-medium">ผล</th>
            <th className="py-2 pr-4 text-right font-medium">สถานะ</th>
          </tr>
        </thead>
        <tbody>
          {history.map((h) => {
            const outcome = h.result ? MATCH_OUTCOME_BADGE[h.result] : null;
            const matchStatus = MATCH_STATUS_BADGE[h.status];
            return (
              <tr key={h.matchId} className="border-b border-neutral-100 last:border-0">
                <td className="py-2 pl-4 pr-3 text-neutral-500">
                  {h.roundNumber != null ? `R${h.roundNumber}` : "ฝึกซ้อม"}
                </td>
                <td className="py-2 pr-3 text-neutral-500">{h.tableNumber ?? "—"}</td>
                <td className="py-2 pr-3">{h.opponent ? `vs ${h.opponent}` : "Bye"}</td>
                <td className="py-2 pr-3 text-right font-medium tabular-nums">
                  {h.opponent && h.myScore != null && h.oppScore != null ? `${h.myScore} - ${h.oppScore}` : "—"}
                </td>
                <td className="py-2 pr-3 text-center">
                  {outcome ? <Badge variant={outcome.variant}>{outcome.label}</Badge> : "—"}
                </td>
                <td className="py-2 pr-4 text-right">
                  <Badge variant={matchStatus.variant}>{matchStatus.label}</Badge>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
