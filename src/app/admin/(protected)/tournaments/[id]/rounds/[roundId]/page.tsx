import { notFound } from "next/navigation";
import { requireTournamentAccess } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { adminRejectByeClaim, adminSetMatchResult } from "@/lib/actions/match";
import { BYE_SCORE } from "@/lib/match/bye";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { deleteRound, repairRoundForAbsences, swapPreviewPlayers } from "@/lib/actions/pairing";
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
        orderBy: { createdAt: "asc" },
      },
      absences: { include: { tournamentPlayer: { include: { globalPlayer: true } } } },
    },
  });
  if (!round || round.tournamentId !== id) notFound();

  // Pairing can still be rearranged (no-shows, swaps) until the Round is complete.
  const editable = round.status === "PREVIEW" || round.status === "CONFIRMED";
  const absentIds = new Set(round.absences.map((a) => a.tournamentPlayerId));

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
        ownScore: confirmed ? BYE_SCORE : null,
        opponentScore: confirmed ? 0 : null,
        diff: confirmed ? BYE_SCORE : null,
      });
      continue;
    }

    const diff =
      confirmed && m.finalPlayer1Score != null && m.finalPlayer2Score != null
        ? cappedDiff(m.finalPlayer1Score, m.finalPlayer2Score, round.maximumScoreEnabled, round.maximumScore)
        : null;

    roundRows.push({
      tournamentPlayerId: m.player1Id,
      tournamentPlayerNo: m.player1.tournamentPlayerNo,
      name: m.player1.globalPlayer.name,
      opponentName: m.player2.globalPlayer.name,
      result: confirmed ? m.player1Result : null,
      ownScore: confirmed ? m.finalPlayer1Score : null,
      opponentScore: confirmed ? m.finalPlayer2Score : null,
      diff,
    });
    roundRows.push({
      tournamentPlayerId: m.player2Id!,
      tournamentPlayerNo: m.player2.tournamentPlayerNo,
      name: m.player2.globalPlayer.name,
      opponentName: m.player1.globalPlayer.name,
      result: confirmed ? m.player2Result : null,
      ownScore: confirmed ? m.finalPlayer2Score : null,
      opponentScore: confirmed ? m.finalPlayer1Score : null,
      diff: diff == null ? null : -diff,
    });
  }
  // No-shows: forfeit L 0-100 (-100), no opponent.
  for (const a of round.absences) {
    roundRows.push({
      tournamentPlayerId: a.tournamentPlayerId,
      tournamentPlayerNo: a.tournamentPlayer.tournamentPlayerNo,
      name: a.tournamentPlayer.globalPlayer.name,
      opponentName: "— (ไม่มา)",
      result: "LOSS",
      ownScore: 0,
      opponentScore: BYE_SCORE,
      diff: -BYE_SCORE,
    });
  }
  roundRows.sort((a, b) => a.tournamentPlayerNo - b.tournamentPlayerNo);

  // Check-in list: everyone this Round is responsible for, seated or already marked absent.
  // A player in a match that has started can't be marked absent (they were clearly there).
  type Attendee = {
    id: string;
    no: number;
    name: string;
    seat: string;
    locked: boolean;
    reportedAbsentBy: string | null;
  };
  const attendees: Attendee[] = [];
  for (const m of round.matches) {
    const started = m.submissions.length > 0 || ["SUBMITTED", "CONFLICT", "CONFIRMED"].includes(m.status);
    const seat = m.isBye || !m.player2 ? "Bye" : m.table ? `โต๊ะ ${m.table.tableNumber}` : "—";
    const sides = [
      { p: m.player1, other: m.player2 },
      ...(m.player2 ? [{ p: m.player2, other: m.player1 }] : []),
    ];
    for (const { p, other } of sides) {
      attendees.push({
        id: p.id,
        no: p.tournamentPlayerNo,
        name: p.globalPlayer.name,
        seat,
        locked: started,
        reportedAbsentBy:
          other && m.byeClaimedById === other.id && m.status !== "CONFIRMED" ? other.globalPlayer.name : null,
      });
    }
  }
  for (const a of round.absences) {
    attendees.push({
      id: a.tournamentPlayerId,
      no: a.tournamentPlayer.tournamentPlayerNo,
      name: a.tournamentPlayer.globalPlayer.name,
      seat: "ไม่มา",
      locked: false,
      reportedAbsentBy: null,
    });
  }
  attendees.sort((a, b) => a.no - b.no);
  const swappable = attendees.filter((a) => !a.locked && !absentIds.has(a.id));

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

      {editable && (
        <AttendanceCard
          roundId={round.id}
          pairingMethod={round.pairingMethod ?? "RANDOM"}
          attendees={attendees}
          absentIds={absentIds}
        />
      )}
      {editable && swappable.length >= 2 && <SwapCard roundId={round.id} players={swappable} />}

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
                    ผล: {m.finalPlayer1Score} - {m.finalPlayer2Score}
                    {m.editedByAdminId && " (แก้ไขโดย Admin/Staff)"}
                  </p>
                )}

                {m.byeClaimedById && m.player2 && m.status !== "CONFIRMED" && editable && (
                  <ByeClaimBanner
                    roundId={round.id}
                    matchId={m.id}
                    claimantName={
                      m.byeClaimedById === m.player1Id ? m.player1.globalPlayer.name : m.player2.globalPlayer.name
                    }
                    absentName={
                      m.byeClaimedById === m.player1Id ? m.player2.globalPlayer.name : m.player1.globalPlayer.name
                    }
                    absentPlayerId={m.byeClaimedById === m.player1Id ? m.player2.id : m.player1Id}
                    currentAbsentIds={[...absentIds]}
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

const PAIRING_METHOD_LABEL: Record<string, string> = {
  RANDOM: "Random",
  SWISS: "Swiss",
  KING_OF_THE_HILL: "King of the Hill",
  ROUND_ROBIN: "Round Robin",
};

// Check-in: tick everyone who didn't show up, then re-pair around them in one go — the
// players left without an opponent play each other instead of each getting a Bye.
function AttendanceCard({
  roundId,
  pairingMethod,
  attendees,
  absentIds,
}: {
  roundId: string;
  pairingMethod: string;
  attendees: {
    id: string;
    no: number;
    name: string;
    seat: string;
    locked: boolean;
    reportedAbsentBy: string | null;
  }[];
  absentIds: Set<string>;
}) {
  return (
    <Card className="mb-6">
      <p className="text-sm font-medium text-neutral-900">เช็คชื่อ — ใครไม่มา?</p>
      <p className="mt-1 text-xs text-neutral-500">
        คนที่ไม่มาได้ L 0-{BYE_SCORE} (-{BYE_SCORE}) · คนที่คู่ไม่มาจะถูกจับคู่ใหม่กันเองแบบ{" "}
        {PAIRING_METHOD_LABEL[pairingMethod] ?? pairingMethod} · ถ้าเหลือคนเดียวได้ Bye W {BYE_SCORE}-0 ·
        คู่ที่มาครบจะไม่ถูกแตะ
      </p>
      <form action={repairRoundForAbsences} className="mt-3">
        <input type="hidden" name="roundId" value={roundId} />
        <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
          {attendees.map((a) => (
            <label
              key={a.id}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                a.locked
                  ? "cursor-not-allowed border-neutral-100 text-neutral-400"
                  : a.reportedAbsentBy
                    ? "cursor-pointer border-warning/40 bg-warning/5"
                    : "cursor-pointer border-neutral-200 hover:border-neutral-300"
              }`}
              title={a.locked ? "แมตช์นี้มีการส่งผลแล้ว" : undefined}
            >
              <input
                type="checkbox"
                name="absentPlayerIds"
                value={a.id}
                defaultChecked={absentIds.has(a.id)}
                disabled={a.locked}
                className="accent-danger"
              />
              <span className="min-w-0 flex-1 truncate">
                {a.name} <span className="text-xs text-neutral-400">#{a.no}</span>
              </span>
              <span className="shrink-0 text-[11px] text-neutral-400">
                {a.reportedAbsentBy ? `${a.reportedAbsentBy} แจ้งว่าไม่มา` : a.seat}
              </span>
            </label>
          ))}
        </div>
        <SubmitButton size="sm" className="mt-3" pendingLabel="กำลังจัดคู่ใหม่...">
          บันทึกและจัดคู่ใหม่
        </SubmitButton>
      </form>
    </Card>
  );
}

// Manual fine-tuning after the automatic re-pairing — only between matches nobody has started.
function SwapCard({
  roundId,
  players,
}: {
  roundId: string;
  players: { id: string; no: number; name: string; seat: string }[];
}) {
  const selectClass =
    "rounded-lg border border-neutral-200 bg-white/70 px-2 py-1.5 text-sm outline-none focus:border-accent";
  return (
    <details className="group mb-6">
      <summary className="cursor-pointer text-xs text-neutral-500 group-open:mb-2">สลับผู้เล่นเอง</summary>
      <Card padding="p-4">
        <form action={swapPreviewPlayers} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="roundId" value={roundId} />
          {(["playerAId", "playerBId"] as const).map((name, i) => (
            <div key={name}>
              <label className="text-[11px] text-neutral-500">{i === 0 ? "ผู้เล่น" : "สลับกับ"}</label>
              <select name={name} required defaultValue="" className={`mt-1 block ${selectClass}`}>
                <option value="" disabled>
                  เลือกผู้เล่น
                </option>
                {players.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.seat})
                  </option>
                ))}
              </select>
            </div>
          ))}
          <SubmitButton size="sm" variant="secondary">
            สลับ
          </SubmitButton>
        </form>
        <p className="mt-2 text-[11px] text-neutral-400">สลับได้เฉพาะแมตช์ที่ยังไม่มีใครส่งผล</p>
      </Card>
    </details>
  );
}

// A player at the table reported that their opponent never showed up. Approving marks the
// opponent absent (on top of anyone already marked) and re-pairs, same as the check-in card.
function ByeClaimBanner({
  roundId,
  matchId,
  claimantName,
  absentName,
  absentPlayerId,
  currentAbsentIds,
  claimedAt,
}: {
  roundId: string;
  matchId: string;
  claimantName: string;
  absentName: string;
  absentPlayerId: string;
  currentAbsentIds: string[];
  claimedAt: Date | null;
}) {
  return (
    <div className="mt-2 rounded-lg bg-warning/10 px-3 py-2 text-xs text-neutral-700">
      <p>
        <span className="font-medium">{claimantName}</span> แจ้งว่า{" "}
        <span className="font-medium">{absentName}</span> ไม่มา
        {claimedAt && (
          <span className="text-neutral-500">
            {" "}
            · {claimedAt.toLocaleTimeString("th-TH", { timeStyle: "short", timeZone: "Asia/Bangkok" })}
          </span>
        )}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <form action={repairRoundForAbsences}>
          <input type="hidden" name="roundId" value={roundId} />
          {[...new Set([...currentAbsentIds, absentPlayerId])].map((pid) => (
            <input key={pid} type="hidden" name="absentPlayerIds" value={pid} />
          ))}
          <SubmitButton size="sm" pendingLabel="กำลังจัดคู่ใหม่...">
            ยืนยันว่า {absentName} ไม่มา และจัดคู่ใหม่
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
