import { getActiveMatchForTable } from "@/lib/match/lookup";
import { submitMatchResult } from "@/lib/actions/match";
import { ResultForm } from "@/components/match/ResultForm";
import { Card } from "@/components/ui/Card";

const RESULT_LABEL: Record<string, string> = { WIN: "ชนะ", TIE: "เสมอ", LOSS: "แพ้" };

export default async function TableMatchPage(props: PageProps<"/table/[qrToken]">) {
  const { qrToken } = await props.params;
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

  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <p className="text-center text-xs text-neutral-500">
        {tournament.name} · Table {table.tableNumber}
      </p>
      <h1 className="mt-1 text-center text-lg font-semibold text-neutral-900">
        {player1Name} vs {player2Name}
      </h1>
      <p className="text-center text-xs text-neutral-400">รอบที่ {round.roundNumber}</p>

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
              heading="ผลที่ฝั่งแรกส่ง"
            />
            <ResultForm
              action={submitMatchResult}
              extraHiddenFields={{ qrToken }}
              matchId={match.id}
              side="PLAYER2"
              player1Name={player1Name}
              player2Name={player2Name}
              previous={submissionBySide.get("PLAYER2")}
              heading="ผลที่ฝั่งที่สองส่ง"
            />
          </>
        ) : (
          // PENDING (no reports yet) or SUBMITTED (one side already reported) — only the
          // remaining, still-empty slot needs a form; spec §13's cross-check (submitMatchResult
          // comparing both submissions) is unchanged, this just avoids showing an already-filled
          // side's form to the next person at the table.
          <>
            {match.status === "SUBMITTED" && (
              <p className="text-center text-xs text-neutral-500">
                อีกฝ่ายส่งผลแล้ว กรุณากรอกผลของอีกฝ่ายเพื่อยืนยัน
              </p>
            )}
            <ResultForm
              action={submitMatchResult}
              extraHiddenFields={{ qrToken }}
              matchId={match.id}
              side={submissionBySide.has("PLAYER1") ? "PLAYER2" : "PLAYER1"}
              player1Name={player1Name}
              player2Name={player2Name}
            />
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
