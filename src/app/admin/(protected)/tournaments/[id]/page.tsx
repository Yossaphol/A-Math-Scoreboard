import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getScoreboard, type ScoreboardRow } from "@/lib/scoreboard";
import { getFirstSecondTotals } from "@/lib/pairing/first-second";
import { startPairing, confirmPairing, cancelPreview } from "@/lib/actions/pairing";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ConfirmSubmitButton } from "@/components/ui/ConfirmSubmitButton";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { NewRoundModal } from "@/components/ui/NewRoundModal";
import { RoundPreviewBoard, type PreviewMatch } from "@/components/ui/RoundPreviewBoard";

const METHOD_LABEL: Record<string, string> = {
  RANDOM: "Random",
  SWISS: "Swiss",
  KING_OF_THE_HILL: "King of the Hill",
  ROUND_ROBIN: "Round Robin",
};

export default async function TournamentOverviewPage(props: PageProps<"/admin/tournaments/[id]">) {
  const { id } = await props.params;

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
  const firstSecondTotals = tournament.useFirstSecond
    ? await getFirstSecondTotals(id)
    : new Map<string, number>();

  const activePlayers =
    tournament.mode === "PRACTICE"
      ? await prisma.tournamentPlayer.findMany({
          where: { tournamentId: id, status: "ACTIVE" },
          include: { globalPlayer: true },
          orderBy: { tournamentPlayerNo: "asc" },
        })
      : [];

  const isPreview = currentRound?.status === "DRAFT" || currentRound?.status === "PREVIEW";

  return (
    <div>
      <PageHeader
        title="Scoreboard"
        actions={
          !currentRound && (
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
        }
      />

      {currentRound && isPreview && (
        <RoundPreviewSection round={currentRound} statsByPlayer={statsByPlayer} />
      )}

      {currentRound && !isPreview && (
        <Card className="mb-6 flex items-center justify-between !bg-accent/5 border-accent/20">
          <span className="text-sm text-neutral-700">
            Round {currentRound.roundNumber} · {METHOD_LABEL[currentRound.pairingMethod ?? ""]} ·
            กำลังแข่งขัน
            {(() => {
              const pending = currentRound.matches.filter(
                (m) => m.status !== "CONFIRMED" && m.status !== "BYE"
              ).length;
              return pending > 0
                ? ` — เหลือ ${pending} แมตช์ที่ยังไม่ Confirm ต้องยืนยันผลให้ครบก่อนถึงจะเปิด Round ถัดไปได้`
                : "";
            })()}
          </span>
          <Link
            href={`/admin/tournaments/${currentRound.tournamentId}/rounds/${currentRound.id}`}
            className="shrink-0 text-xs font-medium text-accent hover:underline"
          >
            ไปที่ Round {currentRound.roundNumber} →
          </Link>
        </Card>
      )}

      {rows.length === 0 ? (
        <EmptyState title="ยังไม่มีผู้เล่น" />
      ) : (
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
                <th className="py-3 pr-3 text-right">Diff</th>
                {tournament.useFirstSecond && (
                  <th className="py-3 pr-3 text-right">First/Second</th>
                )}
                <th className="py-3 pr-5">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.tournamentPlayerId} className="border-b border-neutral-100 last:border-0">
                  <td className="py-3 pl-5 pr-3 text-neutral-500">{r.rank}</td>
                  <td className="py-3 pr-3">
                    {r.name}
                    <span className="text-neutral-400">(#{r.tournamentPlayerNo})</span>
                  </td>
                  <td className="py-3 pr-3 text-right font-medium">{r.points}</td>
                  <td className="py-3 pr-3 text-center">{r.wins}</td>
                  <td className="py-3 pr-3 text-center">{r.ties}</td>
                  <td className="py-3 pr-3 text-center">{r.losses}</td>
                  <td className="py-3 pr-3 text-right">{r.ownScoreTotal}</td>
                  <td className="py-3 pr-3 text-right">{r.opponentScoreTotal}</td>
                  <td className="py-3 pr-3 text-right">
                    {r.cumulativeDiff > 0 ? `+${r.cumulativeDiff}` : r.cumulativeDiff}
                  </td>
                  {tournament.useFirstSecond && (
                    <td className="py-3 pr-3 text-right">
                      {firstSecondTotals.get(r.tournamentPlayerId) ?? 0}
                    </td>
                  )}
                  <td className="py-3 pr-5">
                    {r.status === "WITHDRAWN" && <Badge variant="neutral">Withdrawn</Badge>}
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
  stats: ScoreboardRow | undefined
) {
  return {
    playerId,
    tournamentPlayerNo: player.tournamentPlayerNo,
    name: player.globalPlayer.name,
    isFirst,
    isSecond,
    wins: stats?.wins ?? 0,
    ties: stats?.ties ?? 0,
    losses: stats?.losses ?? 0,
    diff: stats?.cumulativeDiff ?? 0,
  };
}

function RoundPreviewSection({
  round,
  statsByPlayer,
}: {
  round: PreviewRound;
  statsByPlayer: Map<string, ScoreboardRow>;
}) {
  const matches: PreviewMatch[] = round.matches.map((m) => ({
    id: m.id,
    tableNumber: m.table?.tableNumber ?? null,
    player1: toSlot(
      m.player1Id,
      m.player1,
      m.firstPlayerId === m.player1Id,
      m.secondPlayerId === m.player1Id,
      statsByPlayer.get(m.player1Id)
    ),
    player2: m.player2
      ? toSlot(
          m.player2Id!,
          m.player2,
          m.firstPlayerId === m.player2Id,
          m.secondPlayerId === m.player2Id,
          statsByPlayer.get(m.player2Id!)
        )
      : null,
  }));
  // Seated matches in table order so the list mirrors the room; Byes (no table) go last.
  matches.sort((a, b) => (a.tableNumber ?? Infinity) - (b.tableNumber ?? Infinity));

  return (
    <div className="mb-6">
      <Card className="mb-4 flex flex-wrap items-center justify-between gap-3 !bg-amber-50/70 border-amber-200">
        <span className="text-sm text-amber-900">
          Round {round.roundNumber} · {METHOD_LABEL[round.pairingMethod ?? ""]} · Preview —
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
