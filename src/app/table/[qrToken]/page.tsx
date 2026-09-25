import Link from "next/link";
import { getActiveMatchForTable, getLastFinishedMatchForTable } from "@/lib/match/lookup";
import { cancelLateByeClaim, claimLateBye, submitMatchResult } from "@/lib/actions/match";
import { BYE_SCORE } from "@/lib/match/bye";
import { ResultForm } from "@/components/match/ResultForm";
import { ResultSummary } from "@/components/match/ResultSummary";
import { SubmittedResultCard } from "@/components/match/SubmittedResultCard";
import { AutoRefresh } from "@/components/ui/AutoRefresh";
import { Card } from "@/components/ui/Card";
import { ConfirmSubmitButton } from "@/components/ui/ConfirmSubmitButton";
import { SubmitButton } from "@/components/ui/SubmitButton";

const RESULT_LABEL: Record<string, string> = { WIN: "ชนะ", TIE: "เสมอ", LOSS: "แพ้" };

export default async function TableMatchPage(props: PageProps<"/table/[qrToken]">) {
  const { qrToken } = await props.params;
  const { side: sideParam } = await props.searchParams;
  const result = await getActiveMatchForTable(qrToken);

  if ("error" in result) {
    // Confirming the last open match of a round completes the round right away — keep
    // showing the result this table just agreed on instead of "no round in progress".
    const finished = result.code === "no-round" ? await getLastFinishedMatchForTable(qrToken) : null;
    if (finished && finished.match.player2) {
      return (
        <ConfirmedResult
          heading={`${finished.tournament.name} · Table ${finished.table.tableNumber}`}
          match={finished.match}
          player2={finished.match.player2}
          footer={
            finished.tournament.status === "COMPLETED"
              ? "การแข่งขันจบแล้ว"
              : `รอบที่ ${finished.round.roundNumber} จบแล้ว — รอ Admin/Staff จับคู่รอบถัดไป`
          }
        />
      );
    }
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
        <Card className="text-center">
          <p className="text-sm text-neutral-500">{result.error}</p>
        </Card>
      </main>
    );
  }

  const { table, tournament, round, match } = result;

  if (match.isBye) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
        <Card className="text-center">
          <p className="text-xs text-neutral-500">
            {tournament.name} · Table {table.tableNumber}
          </p>
          <p className="mt-4 text-sm font-medium">โต๊ะนี้ไม่มีคู่แข่งขันในรอบนี้ (Bye)</p>
          <p className="mt-1 text-xs text-neutral-400">รอบที่ {round.roundNumber}</p>
        </Card>
      </main>
    );
  }

  if (match.status === "CONFIRMED") {
    return (
      <ConfirmedResult
        heading={`${tournament.name} · Table ${table.tableNumber}`}
        match={match}
        player2={match.player2!}
        footer={`รอบที่ ${round.roundNumber}`}
      />
    );
  }

  const submissionBySide = new Map(match.submissions.map((s) => [s.side, s]));
  const player1Name = match.player1.globalPlayer.name;
  const player2Name = match.player2!.globalPlayer.name;
  const nameOf = (side: "PLAYER1" | "PLAYER2") => (side === "PLAYER1" ? player1Name : player2Name);
  const chosenSide = sideParam === "PLAYER1" || sideParam === "PLAYER2" ? sideParam : undefined;
  const otherSide = chosenSide === "PLAYER1" ? "PLAYER2" : "PLAYER1";
  const mySubmission = chosenSide ? submissionBySide.get(chosenSide) : undefined;
  const claimantName = match.byeClaimedById
    ? match.byeClaimedById === match.player1Id
      ? player1Name
      : player2Name
    : null;
  // Only while this page is waiting on someone else: the other side's report, a conflict
  // being sorted out, or Staff deciding on a no-show claim.
  const waitingOnOthers = match.status === "CONFLICT" || !!claimantName || !!mySubmission;

  return (
    <main className="mx-auto max-w-md px-4 py-10">
      {waitingOnOthers && <AutoRefresh />}
      <p className="text-center text-xs text-neutral-500">
        {tournament.name} · Table {table.tableNumber}
      </p>
      <h1 className="mt-1 text-center text-lg font-semibold text-neutral-900">
        {player1Name} vs {player2Name}
      </h1>
      <p className="text-center text-xs text-neutral-400">รอบที่ {round.roundNumber}</p>

      {claimantName && (
        <Card className="mt-4 text-center">
          <p className="text-sm text-neutral-800">
            {claimantName} แจ้งว่า {match.byeClaimedById === match.player1Id ? player2Name : player1Name} ไม่มา
          </p>
          <p className="mt-0.5 text-xs text-neutral-500">รอ Admin/Staff ยืนยันและจัดคู่ใหม่</p>
          <form action={cancelLateByeClaim} className="mt-3">
            <input type="hidden" name="matchId" value={match.id} />
            <input type="hidden" name="qrToken" value={qrToken} />
            <SubmitButton size="sm" variant="secondary">
              คู่แข่งมาแล้ว — ยกเลิกคำแจ้ง
            </SubmitButton>
          </form>
        </Card>
      )}

      {match.status === "CONFLICT" && (
        <Card className="mt-4 !bg-red-50/80 border-red-200 text-center">
          <p className="text-sm text-danger">
            ผลที่สองฝ่ายส่งมาไม่ตรงกัน ตรวจสอบกันอีกครั้งแล้วแก้ผลที่ผิดให้ตรงกัน หรือแจ้ง Admin/Staff
          </p>
        </Card>
      )}

      <div className="mt-6 flex flex-col gap-4">
        {match.status === "CONFLICT" ? (
          // Both sides already reported and disagreed — either one can correct theirs. Keyed
          // by each report's updatedAt so a correction made on the other phone (picked up by
          // the auto-refresh) replaces what this page shows instead of leaving stale values.
          (["PLAYER1", "PLAYER2"] as const).map((side) => {
            const submission = submissionBySide.get(side);
            return (
              <ResultForm
                key={`${side}-${submission?.updatedAt.getTime() ?? "none"}`}
                action={submitMatchResult}
                extraHiddenFields={{ qrToken }}
                matchId={match.id}
                side={side}
                player1Name={player1Name}
                player2Name={player2Name}
                previous={submission}
                heading={`ผลที่ ${nameOf(side)} ส่ง`}
              />
            );
          })
        ) : chosenSide && mySubmission ? (
          <SubmittedResultCard
            key={mySubmission.updatedAt.getTime()}
            summary={
              <ResultSummary
                player1={{ name: player1Name, score: mySubmission.player1Score }}
                player2={{ name: player2Name, score: mySubmission.player2Score }}
              />
            }
            waitingFor={nameOf(otherSide)}
            switchSideHref={`/table/${qrToken}?side=${otherSide}`}
            editForm={
              <ResultForm
                action={submitMatchResult}
                extraHiddenFields={{ qrToken }}
                matchId={match.id}
                side={chosenSide}
                player1Name={player1Name}
                player2Name={player2Name}
                previous={mySubmission}
                heading={`แก้ไขผลที่ ${nameOf(chosenSide)} ส่ง`}
              />
            }
          />
        ) : chosenSide ? (
          // This side hasn't reported yet — an empty form, deliberately not pre-filled with the
          // other side's report so each side's entry stays independent (spec §13).
          <>
            <p className="text-center text-xs text-neutral-400">
              กำลังส่งผลในนาม <span className="font-medium text-neutral-700">{nameOf(chosenSide)}</span> ·{" "}
              <Link href={`/table/${qrToken}`} className="hover:underline">
                ไม่ใช่ฝั่งนี้? เลือกใหม่
              </Link>
            </p>
            <ResultForm
              key={chosenSide}
              action={submitMatchResult}
              extraHiddenFields={{ qrToken }}
              matchId={match.id}
              side={chosenSide}
              player1Name={player1Name}
              player2Name={player2Name}
            />
            {!claimantName && match.submissions.length === 0 && (
              <form action={claimLateBye} className="text-center">
                <input type="hidden" name="matchId" value={match.id} />
                <input type="hidden" name="qrToken" value={qrToken} />
                <input type="hidden" name="side" value={chosenSide} />
                <ConfirmSubmitButton
                  label="คู่แข่งไม่มา? แจ้ง Admin/Staff"
                  variant="ghost"
                  confirmTitle={`${nameOf(otherSide)} ไม่มา?`}
                  confirmMessage={`Admin/Staff จะยืนยันแล้วหาคู่แข่งใหม่ให้จากคนที่คู่ไม่มาเหมือนกัน ถ้าไม่มีใครเหลือ คุณจะได้ Bye ชนะ ${BYE_SCORE}-0 — ถ้าคู่แข่งมาทันและส่งผลตรงกันทั้งสองฝั่ง คำแจ้งนี้จะถูกยกเลิกเอง`}
                />
              </form>
            )}
          </>
        ) : (
          // Ask explicitly which side is about to submit, instead of guessing from
          // submission state — whoever has the phone picks their own name.
          <>
            <p className="text-center text-sm text-neutral-500">คุณคือฝั่งไหน?</p>
            <div className="grid grid-cols-2 gap-3">
              {(["PLAYER1", "PLAYER2"] as const).map((side) => (
                <Link key={side} href={`/table/${qrToken}?side=${side}`} className="block">
                  <Card padding="p-4" className="text-center transition-shadow hover:shadow-md">
                    <p className="font-medium text-neutral-900">{nameOf(side)}</p>
                    {submissionBySide.has(side) && (
                      <p className="mt-1 text-[11px] text-success">ส่งผลแล้ว</p>
                    )}
                  </Card>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  );
}

function ConfirmedResult({
  heading,
  match,
  player2,
  footer,
}: {
  heading: string;
  match: {
    player1: { globalPlayer: { name: string } };
    finalPlayer1Score: number | null;
    finalPlayer2Score: number | null;
    player1Result: string | null;
    player2Result: string | null;
  };
  player2: { globalPlayer: { name: string } };
  footer: string;
}) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
      <Card className="text-center">
        <p className="text-xs text-neutral-500">{heading}</p>
        <p className="mt-2 text-sm font-medium text-success">ผลการแข่งขันยืนยันแล้ว</p>
        <div className="mt-6 flex items-center justify-center gap-6 text-sm">
          <PlayerResult
            name={match.player1.globalPlayer.name}
            score={match.finalPlayer1Score}
            result={match.player1Result}
          />
          <span className="text-neutral-400">VS</span>
          <PlayerResult name={player2.globalPlayer.name} score={match.finalPlayer2Score} result={match.player2Result} />
        </div>
        <p className="mt-4 text-xs text-neutral-400">{footer}</p>
      </Card>
    </main>
  );
}

function PlayerResult({
  name,
  score,
  result,
}: {
  name: string;
  score: number | null;
  result: string | null;
}) {
  return (
    <div>
      <p className="font-medium text-neutral-900">{name}</p>
      <p className="text-2xl font-semibold text-neutral-900">{score}</p>
      {result && <p className="text-xs text-neutral-500">{RESULT_LABEL[result]}</p>}
    </div>
  );
}
