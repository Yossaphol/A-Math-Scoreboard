import { notFound } from "next/navigation";
import { requireTournamentAccess } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { adminRejectByeClaim, adminSetLateBye, adminSetMatchResult } from "@/lib/actions/match";
import { BYE_SCORE } from "@/lib/match/bye";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { deleteRound } from "@/lib/actions/pairing";
import { cappedDiff } from "@/lib/match/diff";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ConfirmSubmitButton } from "@/components/ui/ConfirmSubmitButton";
import { MATCH_STATUS_BADGE, ROUND_STATUS_BADGE, MATCH_OUTCOME_BADGE } from "@/lib/status-labels";
import type { MatchOutcome } from "@/generated/prisma/enums";

type RoundScoreRow = {
  tournamentPlayerId: string;
  tournamentPlayerNo: number;
  name: string;
  opponentName: string;
  result: MatchOutcome | null;
  ownScore: number | null;
  opponentScore: number | null;
  diff: number | null;
};

export default async function AdminRoundDetailPage(
  props: PageProps<"/admin/tournaments/[id]/rounds/[roundId]">
) {
  const { id, roundId } = await props.params;
  await requireTournamentAccess(id);

  const round = await prisma.round.findUnique({
    where: { id: roundId },
    include: {
      matches: {
        include: {
          table: true,
          player1: { include: { globalPlayer: true } },
          player2: { include: { globalPlayer: true } },
          submissions: true,
        },
      },
    },
  });
  if (!round || round.tournamentId !== id) notFound();

  const latestRound = await prisma.round.findFirst({
    where: { tournamentId: id },
    orderBy: { roundNumber: "desc" },
    select: { id: true },
  });
  const isLatestRound = latestRound?.id === round.id;

  const roundStatus = ROUND_STATUS_BADGE[round.status];

  // This Round's own summary only — unlike the Tournament-wide Scoreboard (which sums every
  // Round), each player appears once here with just their opponent and result for THIS Round.
  const roundRows: RoundScoreRow[] = [];
  for (const m of round.matches) {
    const confirmed = m.status === "CONFIRMED" || m.status === "BYE";

    if (m.isBye || !m.player2) {
      roundRows.push({
        tournamentPlayerId: m.player1Id,
        tournamentPlayerNo: m.player1.tournamentPlayerNo,
        name: m.player1.globalPlayer.name,
        opponentName: "Bye",
        result: confirmed ? "WIN" : null,
        ownScore: confirmed ? 100 : null,
        opponentScore: confirmed ? 0 : null,
        diff: confirmed ? 100 : null,
      });
      continue;
    }

    // A late-arrival Bye (forfeitPlayerId) is stored as 100-0 and never capped.
    const diff =
      confirmed && m.finalPlayer1Score != null && m.finalPlayer2Score != null
        ? m.forfeitPlayerId
          ? m.finalPlayer1Score - m.finalPlayer2Score
          : cappedDiff(m.finalPlayer1Score, m.finalPlayer2Score, round.maximumScoreEnabled, round.maximumScore)
        : null;
    const absentMark = (playerId: string) =>
      confirmed && m.forfeitPlayerId === playerId ? " (ไม่มา)" : "";

    roundRows.push({
      tournamentPlayerId: m.player1Id,
      tournamentPlayerNo: m.player1.tournamentPlayerNo,
      name: m.player1.globalPlayer.name + absentMark(m.player1Id),
      opponentName: m.player2.globalPlayer.name + absentMark(m.player2Id!),
      result: confirmed ? m.player1Result : null,
      ownScore: confirmed ? m.finalPlayer1Score : null,
      opponentScore: confirmed ? m.finalPlayer2Score : null,
      diff,
    });
    roundRows.push({
      tournamentPlayerId: m.player2Id!,
      tournamentPlayerNo: m.player2.tournamentPlayerNo,
      name: m.player2.globalPlayer.name + absentMark(m.player2Id!),
      opponentName: m.player1.globalPlayer.name + absentMark(m.player1Id),
      result: confirmed ? m.player2Result : null,
      ownScore: confirmed ? m.finalPlayer2Score : null,
      opponentScore: confirmed ? m.finalPlayer1Score : null,
      diff: diff == null ? null : -diff,
    });
  }
  roundRows.sort((a, b) => a.tournamentPlayerNo - b.tournamentPlayerNo);

  return (
    <div>
      <PageHeader
        title={`Round ${round.roundNumber}`}
        actions={
          <div className="flex items-center gap-3">
            <Badge variant={roundStatus.variant}>{roundStatus.label}</Badge>
            {isLatestRound && (
              <form action={deleteRound}>
                <input type="hidden" name="roundId" value={round.id} />
                <ConfirmSubmitButton
                  label="ลบ Round"
                  confirmTitle={`ลบ Round ${round.roundNumber}?`}
                  confirmMessage={
                    round.status === "PREVIEW"
                      ? "Round นี้ยังไม่ Confirm ลบได้โดยไม่มีผลอะไร"
                      : `Match ทุกอันใน Round นี้ (${round.matches.length} แมตช์) จะถูกลบทิ้งไปด้วย รวมคะแนนที่กรอกไปแล้ว — แก้คืนไม่ได้ ใช้เมื่อสร้าง Round นี้ผิดและต้องการสร้างใหม่เท่านั้น`
                  }
                  size="sm"
                />
              </form>
            )}
          </div>
        }
      />

      {roundRows.length > 0 && (
        <Card padding="p-0" className="mb-6 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200/70 text-left text-xs text-neutral-500">
                <th className="py-3 pl-5 pr-3">ผู้เล่น</th>
                <th className="py-3 pr-3">คู่ต่อสู้</th>
                <th className="py-3 pr-3 text-center">ผล</th>
                <th className="py-3 pr-3 text-right">คะแนนที่ทำได้</th>
                <th className="py-3 pr-3 text-right">คะแนนคู่ต่อสู้</th>
                <th className="py-3 pr-5 text-right">ผลต่าง</th>
              </tr>
            </thead>
            <tbody>
              {roundRows.map((r) => {
                const badge = r.result ? MATCH_OUTCOME_BADGE[r.result] : null;
                return (
                  <tr key={r.tournamentPlayerId} className="border-b border-neutral-100 last:border-0">
                    <td className="py-3 pl-5 pr-3">
                      {r.name}
                      <span className="ml-1.5 text-xs text-neutral-400">(#{r.tournamentPlayerNo})</span>
                    </td>
                    <td className="py-3 pr-3 text-neutral-600">{r.opponentName}</td>
                    <td className="py-3 pr-3 text-center">
                      {badge ? <Badge variant={badge.variant}>{badge.label}</Badge> : "—"}
                    </td>
                    <td className="py-3 pr-3 text-right">{r.ownScore ?? "—"}</td>
                    <td className="py-3 pr-3 text-right">{r.opponentScore ?? "—"}</td>
                    <td className="py-3 pr-5 text-right">
                      {r.diff == null ? "—" : r.diff > 0 ? `+${r.diff}` : r.diff}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      <ul className="space-y-3">
        {round.matches.map((m) => {
          const p1Sub = m.submissions.find((s) => s.side === "PLAYER1");
          const p2Sub = m.submissions.find((s) => s.side === "PLAYER2");
          const status = MATCH_STATUS_BADGE[m.status];

          return (
            <li key={m.id}>
              <Card padding="p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="min-w-0 break-words font-medium">
                    {m.player1.globalPlayer.name}
                    {m.player2 ? ` vs ${m.player2.globalPlayer.name}` : " (Bye)"}
                  </span>
                  <div className="flex shrink-0 items-center gap-2">
                    {m.table && (
                      <span className="text-xs text-neutral-500">Table {m.table.tableNumber}</span>
                    )}
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </div>
                </div>

                {m.status === "CONFIRMED" && !m.isBye && (
                  <p className="mt-1.5 text-xs text-neutral-500">
                    {m.forfeitPlayerId && m.player2 ? (
                      <>
                        <Badge variant="info" className="mr-1.5">
                          Bye (มาสาย)
                        </Badge>
                        {m.forfeitPlayerId === m.player1Id
                          ? `${m.player1.globalPlayer.name} ไม่มา — ${m.player2.globalPlayer.name} ชนะ ${BYE_SCORE}-0`
                          : `${m.player2.globalPlayer.name} ไม่มา — ${m.player1.globalPlayer.name} ชนะ ${BYE_SCORE}-0`}
                      </>
                    ) : (
                      <>
                        ผล: {m.finalPlayer1Score} - {m.finalPlayer2Score}
                        {m.editedByAdminId && " (แก้ไขโดย Admin/Staff)"}
                      </>
                    )}
                  </p>
                )}

                {m.byeClaimedById && m.player2 && m.status !== "CONFIRMED" && (
                  <ByeClaimBanner
                    matchId={m.id}
                    claimantName={
                      m.byeClaimedById === m.player1Id ? m.player1.globalPlayer.name : m.player2.globalPlayer.name
                    }
                    absentName={
                      m.byeClaimedById === m.player1Id ? m.player2.globalPlayer.name : m.player1.globalPlayer.name
                    }
                    absentPlayerId={m.byeClaimedById === m.player1Id ? m.player2.id : m.player1Id}
                    claimedAt={m.byeClaimedAt}
                  />
                )}

                {m.status === "CONFLICT" && (p1Sub || p2Sub) && (
                  <div className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-danger">
                    <p>
                      {m.player1.globalPlayer.name} ส่ง: {p1Sub?.player1Score ?? "—"} -{" "}
                      {p1Sub?.player2Score ?? "—"}
                    </p>
                    <p>
                      {m.player2?.globalPlayer.name} ส่ง: {p2Sub?.player1Score ?? "—"} -{" "}
                      {p2Sub?.player2Score ?? "—"}
                    </p>
                  </div>
                )}

                {!m.isBye && m.status !== "CONFIRMED" && (
                  <form action={adminSetMatchResult} className="mt-3 flex flex-wrap items-end gap-2">
                    <input type="hidden" name="matchId" value={m.id} />
                    <ScoreField
                      label={m.player1.globalPlayer.name}
                      name="player1Score"
                      defaultValue={p1Sub?.player1Score ?? p2Sub?.player1Score}
                    />
                    <ScoreField
                      label={m.player2?.globalPlayer.name ?? ""}
                      name="player2Score"
                      defaultValue={p1Sub?.player2Score ?? p2Sub?.player2Score}
                    />
                    <button
                      type="submit"
                      className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-700"
                    >
                      บันทึกผล (Admin)
                    </button>
                  </form>
                )}

                {!m.isBye && m.player2 && m.status !== "CONFIRMED" && (
                  <LateByeControls
                    matchId={m.id}
                    players={[
                      { id: m.player1Id, name: m.player1.globalPlayer.name },
                      { id: m.player2.id, name: m.player2.globalPlayer.name },
                    ]}
                  />
                )}

                {!m.isBye && m.status === "CONFIRMED" && (
                  <details className="mt-2 group">
                    <summary className="cursor-pointer text-xs text-neutral-500 group-open:mb-2">
                      แก้ไขผล
                    </summary>
                    <form action={adminSetMatchResult} className="flex flex-wrap items-end gap-2">
                      <input type="hidden" name="matchId" value={m.id} />
                      <ScoreField
                        label={m.player1.globalPlayer.name}
                        name="player1Score"
                        defaultValue={m.finalPlayer1Score ?? undefined}
                      />
                      <ScoreField
                        label={m.player2?.globalPlayer.name ?? ""}
                        name="player2Score"
                        defaultValue={m.finalPlayer2Score ?? undefined}
                      />
                      <button
                        type="submit"
                        className="rounded-lg border border-neutral-200 bg-white/70 px-3 py-1.5 text-xs hover:bg-white"
                      >
                        บันทึก
                      </button>
                    </form>
                    {m.player2 && (
                      <LateByeControls
                        matchId={m.id}
                        players={[
                          { id: m.player1Id, name: m.player1.globalPlayer.name },
                          { id: m.player2.id, name: m.player2.globalPlayer.name },
                        ]}
                      />
                    )}
                  </details>
                )}
              </Card>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// A player at the table reported that their opponent never showed up — the claim only
// counts once Admin/Staff approve it here.
function ByeClaimBanner({
  matchId,
  claimantName,
  absentName,
  absentPlayerId,
  claimedAt,
}: {
  matchId: string;
  claimantName: string;
  absentName: string;
  absentPlayerId: string;
  claimedAt: Date | null;
}) {
  return (
    <div className="mt-2 rounded-lg bg-warning/10 px-3 py-2 text-xs text-neutral-700">
      <p>
        <span className="font-medium">{claimantName}</span> แจ้งว่า{" "}
        <span className="font-medium">{absentName}</span> ไม่มา — ขอ Bye
        {claimedAt && (
          <span className="text-neutral-500">
            {" "}
            ·{" "}
            {claimedAt.toLocaleTimeString("th-TH", { timeStyle: "short", timeZone: "Asia/Bangkok" })}
          </span>
        )}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <form action={adminSetLateBye}>
          <input type="hidden" name="matchId" value={matchId} />
          <input type="hidden" name="absentPlayerId" value={absentPlayerId} />
          <SubmitButton size="sm">
            อนุมัติ Bye — {claimantName} ชนะ {BYE_SCORE}-0
          </SubmitButton>
        </form>
        <form action={adminRejectByeClaim}>
          <input type="hidden" name="matchId" value={matchId} />
          <SubmitButton size="sm" variant="secondary">
            ปฏิเสธ
          </SubmitButton>
        </form>
      </div>
    </div>
  );
}

// Late-arrival Bye granted directly by Admin/Staff: pick who didn't show up.
function LateByeControls({
  matchId,
  players,
}: {
  matchId: string;
  players: [{ id: string; name: string }, { id: string; name: string }];
}) {
  return (
    <details className="group mt-2">
      <summary className="cursor-pointer text-xs text-neutral-500 group-open:mb-2">
        ให้ Bye (คู่แข่งมาสาย/ไม่มา)
      </summary>
      <div className="flex flex-wrap gap-2">
        {players.map((absent, i) => {
          const present = players[1 - i];
          return (
            <form key={absent.id} action={adminSetLateBye}>
              <input type="hidden" name="matchId" value={matchId} />
              <input type="hidden" name="absentPlayerId" value={absent.id} />
              <ConfirmSubmitButton
                label={`${absent.name} ไม่มา`}
                variant="secondary"
                confirmTitle={`${absent.name} ไม่มา?`}
                confirmMessage={`${present.name} ได้ Bye ชนะ ${BYE_SCORE}-0 (+${BYE_SCORE}) และ ${absent.name} แพ้ 0-${BYE_SCORE} (-${BYE_SCORE}) — แก้กลับได้ด้วยการบันทึกผลใหม่`}
              />
            </form>
          );
        })}
      </div>
    </details>
  );
}

function ScoreField({
  label,
  name,
  defaultValue,
}: {
  label: string;
  name: string;
  defaultValue?: number;
}) {
  return (
    <div>
      <label className="text-[11px] text-neutral-500">{label}</label>
      <input
        type="number"
        min={0}
        name={name}
        defaultValue={defaultValue}
        required
        className="mt-1 block w-24 rounded-lg border border-neutral-200 bg-white/70 px-2 py-1.5 text-sm outline-none focus:border-accent"
      />
    </div>
  );
}
