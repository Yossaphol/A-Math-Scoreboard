import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getScoreboard, type ScoreboardRow } from "@/lib/scoreboard";
import { getFirstSecondScores } from "@/lib/pairing/first-second";
import { startPairing, confirmPairing, cancelPreview } from "@/lib/actions/pairing";
import { AutoRefresh } from "@/components/ui/AutoRefresh";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ConfirmSubmitButton } from "@/components/ui/ConfirmSubmitButton";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { NewRoundModal } from "@/components/ui/NewRoundModal";
import { RoundPreviewBoard, type PreviewMatch } from "@/components/ui/RoundPreviewBoard";
import { roundLimitOf } from "@/lib/tournament-limits";
import { healStuckRounds } from "@/lib/match/round-completion";
import { PAIRING_METHOD_LABEL } from "@/lib/status-labels";

export default async function TournamentOverviewPage(props: PageProps<"/admin/tournaments/[id]">) {
  const { id } = await props.params;

  // Close any fully played round left open, before deciding what "current round" is.
  await healStuckRounds(id);
  const tournament = await prisma.tournament.findUniqueOrThrow({ where: { id } });

  const currentRound = await prisma.round.findFirst({
    where: { tournamentId: id, status: { in: ["DRAFT", "PREVIEW", "CONFIRMED"] } },
    include: {
      matches: {
        include: {
          player1: { include: { globalPlayer: true } },
          player2: { include: { globalPlayer: true } },
          table: { select: { tableNumber: true } },
        },
      },
    },
  });

  const rows = await getScoreboard(id);
  const statsByPlayer = new Map(rows.map((r) => [r.tournamentPlayerId, r]));
  const firstSecondScores = tournament.useFirstSecond
    ? await getFirstSecondScores(id)
    : null;

  const activePlayers =
    tournament.mode === "PRACTICE"
      ? await prisma.tournamentPlayer.findMany({
          where: { tournamentId: id, status: "ACTIVE" },
          include: { globalPlayer: true },
          orderBy: { tournamentPlayerNo: "asc" },
        })
      : [];

  const isPreview = currentRound?.status === "DRAFT" || currentRound?.status === "PREVIEW";

  // Spec §7: with a set number of rounds, "+ New Round" goes away once the last one exists
  // (startPairing refuses it server-side too).
  const roundLimit = roundLimitOf(tournament);
  const lastRound =
    roundLimit != null
      ? await prisma.round.findFirst({ where: { tournamentId: id }, orderBy: { roundNumber: "desc" } })
      : null;
  const allRoundsPlayed = roundLimit != null && (lastRound?.roundNumber ?? 0) >= roundLimit;

  const newRoundAction = !currentRound
    ? allRoundsPlayed
      ? <Badge variant="neutral">แข่งครบ {roundLimit} รอบแล้ว</Badge>
      : (
          <NewRoundModal
            tournamentId={id}
            defaultMaximumScore={tournament.defaultMaximumScore ?? 350}
            action={startPairing}
            mode={tournament.mode}
            activePlayers={activePlayers.map((p) => ({
              id: p.id,
              tournamentPlayerNo: p.tournamentPlayerNo,
              name: p.globalPlayer.name,
            }))}
          />
        )
    : null;

  return (
    <div>
      {/* The tab bar already says "Scoreboard" — no page title, just the round action. */}
      {newRoundAction && <div className="mb-4 flex justify-end">{newRoundAction}</div>}

      {currentRound && isPreview && (
        <RoundPreviewSection round={currentRound} statsByPlayer={statsByPlayer} firstSecondScores={firstSecondScores} />
      )}

      {currentRound && !isPreview && (
        <>
          {/* Results arrive from the tables while the round is on — keep this page current. */}
          <AutoRefresh intervalMs={8000} />
          <LiveRoundBanner tournamentId={id} round={currentRound} />
        </>
      )}

      {rows.length === 0 ? (
        <EmptyState title="ยังไม่มีผู้เล่น" />
      ) : (
        <Card padding="p-0" className="overflow-x-auto">
          <table className="w-full text-sm tabular-nums">
            <thead>
              <tr className="border-b border-neutral-200/70 text-left text-xs text-neutral-500">
                <th className="py-3 pl-5 pr-3">อันดับ</th>
                <th className="py-3 pr-3">Name</th>
                <th className="py-3 pr-3 text-right">Points</th>
                <th className="py-3 pr-3 text-center">W/T/L</th>
                <th className="py-3 pr-3 text-right">คะแนนที่ทำได้</th>
                <th className="py-3 pr-3 text-right">คะแนนคู่ต่อสู้</th>
                <th className="py-3 pr-3 text-right">Diff</th>
                {firstSecondScores && (
                  <th
                    className="py-3 pr-5 text-right"
                    title="เริ่มก่อน +2 · เริ่มหลัง +1 · เกมถัดไปค่าน้อยกว่าได้เริ่มก่อน (เท่ากันสุ่ม)"
                  >
                    เริ่มก่อนหลัง
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                return (
                  <tr
                    key={r.tournamentPlayerId}
                    className={`border-b border-neutral-100 last:border-0 ${
                      r.gamesPlayed === 0 || r.status === "WITHDRAWN" ? "text-neutral-400" : ""
                    }`}
                  >
                    <td className="py-3 pl-5 pr-3 text-neutral-500">{r.rank}</td>
                    <td className="py-3 pr-3">
                      {r.name}
                      <span className="ml-1 text-neutral-400">(#{r.tournamentPlayerNo})</span>
                      {r.status === "WITHDRAWN" && (
                        <Badge variant="neutral" className="ml-2">
                          Withdrawn
                        </Badge>
                      )}
                    </td>
                    <td className="py-3 pr-3 text-right font-medium">{r.points}</td>
                    <td className="whitespace-nowrap py-3 pr-3 text-center">
                      {r.wins}
                      <span className="mx-0.5 text-neutral-300">/</span>
                      {r.ties}
                      <span className="mx-0.5 text-neutral-300">/</span>
                      {r.losses}
                    </td>
                    <td className="py-3 pr-3 text-right">{r.ownScoreTotal}</td>
                    <td className="py-3 pr-3 text-right">{r.opponentScoreTotal}</td>
                    <td className="py-3 pr-3 text-right">
                      {r.cumulativeDiff > 0 ? `+${r.cumulativeDiff}` : r.cumulativeDiff}
                    </td>
                    {firstSecondScores && (
                      <td className="py-3 pr-5 text-right">{firstSecondScores.get(r.tournamentPlayerId) ?? 0}</td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

type LiveRound = {
  id: string;
  roundNumber: number;
  pairingMethod: string | null;
  matches: {
    id: string;
    status: string;
    isBye: boolean;
    byeClaimedById: string | null;
    table: { tableNumber: number } | null;
    player1: { globalPlayer: { name: string } };
    player2: { globalPlayer: { name: string } } | null;
  }[];
};

// The in-progress round at a glance: how many games are in, and every match that needs
// Admin/Staff (score conflict, "opponent didn't show" report) with a link straight to it.
function LiveRoundBanner({ tournamentId, round }: { tournamentId: string; round: LiveRound }) {
  const roundHref = `/admin/tournaments/${tournamentId}/rounds/${round.id}`;
  const total = round.matches.length;
  const done = round.matches.filter((m) => m.status === "CONFIRMED" || m.status === "BYE").length;
  const issues = round.matches
    .map((m) => ({ m, issue: matchIssue(m) }))
    .filter((x): x is { m: LiveRound["matches"][number]; issue: string } => x.issue != null)
    .sort((a, b) => (a.m.table?.tableNumber ?? Infinity) - (b.m.table?.tableNumber ?? Infinity));
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);

  return (
    <Card className={`mb-6 ${issues.length > 0 ? "!bg-red-50/60 border-red-200" : "!bg-accent/5 border-accent/20"}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm text-neutral-700">
          Round {round.roundNumber} · {PAIRING_METHOD_LABEL[round.pairingMethod ?? ""]} · กำลังแข่งขัน
        </span>
        <Link href={roundHref} className="shrink-0 text-xs font-medium text-accent hover:underline">
          ไปที่ Round {round.roundNumber} →
        </Link>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-neutral-200/80">
          <div className="h-full rounded-full bg-success transition-all" style={{ width: `${percent}%` }} />
        </div>
        <span className="shrink-0 text-xs font-medium text-neutral-700">
          ยืนยันแล้ว {done}/{total} แมตช์
        </span>
      </div>
      {done < total && (
        <p className="mt-1 text-[11px] text-neutral-500">ต้องยืนยันผลให้ครบก่อนถึงจะเปิด Round ถัดไปได้</p>
      )}

      {issues.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {issues.map(({ m, issue }) => (
            <li key={m.id}>
              <Link
                href={`${roundHref}#match-${m.id}`}
                className="flex flex-wrap items-center gap-2 rounded-lg bg-white/70 px-3 py-2 text-xs hover:bg-white"
              >
                <Badge variant="danger">{issue}</Badge>
                <span className="text-neutral-500">{m.table ? `โต๊ะ ${m.table.tableNumber}` : "—"}</span>
                <span className="font-medium text-neutral-800">
                  {m.player1.globalPlayer.name} vs {m.player2?.globalPlayer.name}
                </span>
                <span className="ml-auto text-accent">จัดการ →</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function matchIssue(m: LiveRound["matches"][number]): string | null {
  if (m.status === "CONFLICT") return "ผลขัดแย้ง";
  if (m.byeClaimedById && m.player2 && m.status !== "CONFIRMED") return "แจ้งว่าคู่ไม่มา";
  return null;
}

type PreviewRound = {
  id: string;
  roundNumber: number;
  pairingMethod: string | null;
  matches: {
    id: string;
    player1Id: string;
    player2Id: string | null;
    firstPlayerId: string | null;
    secondPlayerId: string | null;
    table: { tableNumber: number } | null;
    player1: { tournamentPlayerNo: number; globalPlayer: { name: string } };
    player2: { tournamentPlayerNo: number; globalPlayer: { name: string } } | null;
  }[];
};

function toSlot(
  playerId: string,
  player: { tournamentPlayerNo: number; globalPlayer: { name: string } },
  isFirst: boolean,
  isSecond: boolean,
  stats: ScoreboardRow | undefined,
  firstSecondScores: Map<string, number> | null
) {
  return {
    playerId,
    tournamentPlayerNo: player.tournamentPlayerNo,
    name: player.globalPlayer.name,
    isFirst,
    isSecond,
    firstSecondScore: firstSecondScores ? (firstSecondScores.get(playerId) ?? 0) : null,
    wins: stats?.wins ?? 0,
    ties: stats?.ties ?? 0,
    losses: stats?.losses ?? 0,
    diff: stats?.cumulativeDiff ?? 0,
  };
}

function RoundPreviewSection({
  round,
  statsByPlayer,
  firstSecondScores,
}: {
  round: PreviewRound;
  statsByPlayer: Map<string, ScoreboardRow>;
  firstSecondScores: Map<string, number> | null;
}) {
  const matches: PreviewMatch[] = round.matches.map((m) => ({
    id: m.id,
    tableNumber: m.table?.tableNumber ?? null,
    player1: toSlot(
      m.player1Id,
      m.player1,
      m.firstPlayerId === m.player1Id,
      m.secondPlayerId === m.player1Id,
      statsByPlayer.get(m.player1Id),
      firstSecondScores
    ),
    player2: m.player2
      ? toSlot(
          m.player2Id!,
          m.player2,
          m.firstPlayerId === m.player2Id,
          m.secondPlayerId === m.player2Id,
          statsByPlayer.get(m.player2Id!),
          firstSecondScores
        )
      : null,
  }));
  // Seated matches in table order so the list mirrors the room; Byes (no table) go last.
  matches.sort((a, b) => (a.tableNumber ?? Infinity) - (b.tableNumber ?? Infinity));

  return (
    <div className="mb-6">
      <Card className="mb-4 flex flex-wrap items-center justify-between gap-3 !bg-amber-50/70 border-amber-200">
        <span className="text-sm text-amber-900">
          Round {round.roundNumber} · {PAIRING_METHOD_LABEL[round.pairingMethod ?? ""]} · Preview —
          ยังไม่ Confirm
        </span>
        <div className="flex gap-2">
          <form action={cancelPreview}>
            <input type="hidden" name="roundId" value={round.id} />
            <ConfirmSubmitButton
              label="Cancel"
              confirmTitle="ยกเลิก Pairing Preview?"
              confirmMessage="การจับคู่ทั้งหมดของ Round นี้จะถูกลบ ต้อง Generate ใหม่"
            />
          </form>
          <form action={confirmPairing}>
            <input type="hidden" name="roundId" value={round.id} />
            <Button type="submit" size="sm">
              Confirm Pairing
            </Button>
          </form>
        </div>
      </Card>

      <RoundPreviewBoard roundId={round.id} matches={matches} />
    </div>
  );
}
