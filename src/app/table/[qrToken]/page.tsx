import Link from "next/link";
import { getActiveMatchForTable } from "@/lib/match/lookup";
import { cancelLateByeClaim, claimLateBye, submitMatchResult } from "@/lib/actions/match";
import { BYE_SCORE } from "@/lib/match/bye";
import { ResultForm } from "@/components/match/ResultForm";
import { Card } from "@/components/ui/Card";
import { ConfirmSubmitButton } from "@/components/ui/ConfirmSubmitButton";
import { SubmitButton } from "@/components/ui/SubmitButton";

const RESULT_LABEL: Record<string, string> = { WIN: "ชนะ", TIE: "เสมอ", LOSS: "แพ้" };

export default async function TableMatchPage(props: PageProps<"/table/[qrToken]">) {
  const { qrToken } = await props.params;
  const { side: sideParam } = await props.searchParams;
  const result = await getActiveMatchForTable(qrToken);

  if ("error" in result) {
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
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
        <Card className="text-center">
          <p className="text-xs text-neutral-500">
            {tournament.name} · Table {table.tableNumber}
          </p>
          <p className="mt-2 text-sm font-medium text-success">ผลการแข่งขันยืนยันแล้ว</p>
          {match.forfeitPlayerId && (
            <p className="mt-1 text-xs text-neutral-500">
              Bye —{" "}
              {match.forfeitPlayerId === match.player1Id
                ? match.player1.globalPlayer.name
                : match.player2!.globalPlayer.name}{" "}
              ไม่มา
            </p>
          )}
          <div className="mt-6 flex items-center justify-center gap-6 text-sm">
            <PlayerResult
              name={match.player1.globalPlayer.name}
              score={match.finalPlayer1Score}
              result={match.player1Result}
            />
            <span className="text-neutral-400">VS</span>
            <PlayerResult
              name={match.player2!.globalPlayer.name}
              score={match.finalPlayer2Score}
              result={match.player2Result}
            />
          </div>
          <p className="mt-4 text-xs text-neutral-400">รอบที่ {round.roundNumber}</p>
        </Card>
      </main>
    );
  }

  const submissionBySide = new Map(match.submissions.map((s) => [s.side, s]));
  const player1Name = match.player1.globalPlayer.name;
  const player2Name = match.player2!.globalPlayer.name;
  const chosenSide = sideParam === "PLAYER1" || sideParam === "PLAYER2" ? sideParam : undefined;
  const claimantName = match.byeClaimedById
    ? match.byeClaimedById === match.player1Id
      ? player1Name
      : player2Name
    : null;

  return (
    <main className="mx-auto max-w-md px-4 py-10">
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
          <p className="mt-0.5 text-xs text-neutral-500">รอ Admin/Staff อนุมัติ Bye</p>
          <form action={cancelLateByeClaim} className="mt-3">
            <input type="hidden" name="matchId" value={match.id} />
            <input type="hidden" name="qrToken" value={qrToken} />
            <SubmitButton size="sm" variant="secondary">
              คู่แข่งมาแล้ว — ยกเลิกคำขอ
            </SubmitButton>
          </form>
        </Card>
      )}

      {match.status === "CONFLICT" && (
        <Card className="mt-4 !bg-red-50/80 border-red-200 text-center">
          <p className="text-sm text-danger">
            ผลที่กรอกจากสองฝ่ายไม่ตรงกัน กรุณาตรวจสอบและส่งผลอีกครั้งทั้งสองฝั่ง
          </p>
        </Card>
      )}

      <div className="mt-6 flex flex-col gap-4">
        {match.status === "CONFLICT" ? (
          // Both sides already reported and disagreed — both need to review and resubmit.
          <>
            <ResultForm
              action={submitMatchResult}
              extraHiddenFields={{ qrToken }}
              matchId={match.id}
              side="PLAYER1"
              player1Name={player1Name}
              player2Name={player2Name}
              previous={submissionBySide.get("PLAYER1")}
              heading={`ผลที่ ${player1Name} ส่ง`}
            />
            <ResultForm
              action={submitMatchResult}
              extraHiddenFields={{ qrToken }}
              matchId={match.id}
              side="PLAYER2"
              player1Name={player1Name}
              player2Name={player2Name}
              previous={submissionBySide.get("PLAYER2")}
              heading={`ผลที่ ${player2Name} ส่ง`}
            />
          </>
        ) : chosenSide ? (
          // Person picked which side they are — show their form, pre-filled if they (or
          // whoever had the phone before them) already sent something for this side.
          <>
            <p className="text-center text-xs text-neutral-400">
              <Link href={`/table/${qrToken}`} className="hover:underline">
                ไม่ใช่ฝั่งนี้? เลือกใหม่
              </Link>
            </p>
            <ResultForm
              action={submitMatchResult}
              extraHiddenFields={{ qrToken }}
              matchId={match.id}
              side={chosenSide}
              player1Name={player1Name}
              player2Name={player2Name}
              previous={submissionBySide.get(chosenSide)}
            />
            {!claimantName && (
              <form action={claimLateBye} className="text-center">
                <input type="hidden" name="matchId" value={match.id} />
                <input type="hidden" name="qrToken" value={qrToken} />
                <input type="hidden" name="side" value={chosenSide} />
                <ConfirmSubmitButton
                  label="คู่แข่งไม่มา? แจ้งขอ Bye"
                  variant="ghost"
                  confirmTitle={`${chosenSide === "PLAYER1" ? player2Name : player1Name} ไม่มา?`}
                  confirmMessage={`แจ้ง Admin/Staff ว่าคู่แข่งไม่มา ถ้าอนุมัติ คุณจะได้ Bye ชนะ ${BYE_SCORE}-0 — ถ้าคู่แข่งมาทันและส่งผลตรงกันทั้งสองฝั่ง คำขอนี้จะถูกยกเลิกเอง`}
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
              {(
                [
                  ["PLAYER1", player1Name],
                  ["PLAYER2", player2Name],
                ] as const
              ).map(([side, name]) => (
                <Link key={side} href={`/table/${qrToken}?side=${side}`} className="block">
                  <Card padding="p-4" className="text-center transition-shadow hover:shadow-md">
                    <p className="font-medium text-neutral-900">{name}</p>
                    {submissionBySide.has(side) && (
                      <p className="mt-1 text-[11px] text-neutral-400">ส่งผลแล้ว — แก้ไขได้</p>
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
