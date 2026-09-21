import { getActiveMatchForTable } from "@/lib/match/lookup";
import { submitMatchResult } from "@/lib/actions/match";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { inputClass, labelClass } from "@/components/ui/styles";

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

  const { table, tournament, match } = result;

  if (match.isBye) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
        <Card className="text-center">
          <p className="text-xs text-neutral-500">
            {tournament.name} · Table {table.tableNumber}
          </p>
          <p className="mt-4 text-sm font-medium">โต๊ะนี้ไม่มีคู่แข่งขันในรอบนี้ (Bye)</p>
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
        </Card>
      </main>
    );
  }

  const submissionBySide = new Map(match.submissions.map((s) => [s.side, s]));

  return (
    <main className="mx-auto max-w-lg px-4 py-10">
      <p className="text-center text-xs text-neutral-500">
        {tournament.name} · Table {table.tableNumber}
      </p>
      <h1 className="mt-1 text-center text-lg font-semibold text-neutral-900">
        {match.player1.globalPlayer.name} vs {match.player2!.globalPlayer.name}
      </h1>

      {match.status === "CONFLICT" && (
        <Card className="mt-4 !bg-red-50/80 border-red-200 text-center">
          <p className="text-sm text-danger">
            ผลที่กรอกจากสองฝ่ายไม่ตรงกัน กรุณาแจ้ง Admin/Staff เพื่อตรวจสอบและแก้ไข
          </p>
        </Card>
      )}

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <SideForm
          qrToken={qrToken}
          matchId={match.id}
          side="PLAYER1"
          selfName={match.player1.globalPlayer.name}
          opponentName={match.player2!.globalPlayer.name}
          previous={submissionBySide.get("PLAYER1")}
        />
        <SideForm
          qrToken={qrToken}
          matchId={match.id}
          side="PLAYER2"
          selfName={match.player2!.globalPlayer.name}
          opponentName={match.player1.globalPlayer.name}
          previous={submissionBySide.get("PLAYER2")}
        />
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

function SideForm({
  qrToken,
  matchId,
  side,
  selfName,
  opponentName,
  previous,
}: {
  qrToken: string;
  matchId: string;
  side: "PLAYER1" | "PLAYER2";
  selfName: string;
  opponentName: string;
  previous?: { player1Score: number; player2Score: number };
}) {
  const selfScore = previous
    ? side === "PLAYER1"
      ? previous.player1Score
      : previous.player2Score
    : undefined;
  const opponentScore = previous
    ? side === "PLAYER1"
      ? previous.player2Score
      : previous.player1Score
    : undefined;

  return (
    <Card as="form" action={submitMatchResult}>
      <input type="hidden" name="matchId" value={matchId} />
      <input type="hidden" name="qrToken" value={qrToken} />
      <input type="hidden" name="side" value={side} />
      <p className="text-sm font-medium text-neutral-900">มุมมองของ {selfName}</p>

      <label className={`${labelClass} mt-3 block`}>คะแนนของ {selfName}</label>
      <input
        type="number"
        min={0}
        name={side === "PLAYER1" ? "player1Score" : "player2Score"}
        defaultValue={selfScore}
        required
        className={`${inputClass} mt-1`}
      />

      <label className={`${labelClass} mt-3 block`}>คะแนนของ {opponentName}</label>
      <input
        type="number"
        min={0}
        name={side === "PLAYER1" ? "player2Score" : "player1Score"}
        defaultValue={opponentScore}
        required
        className={`${inputClass} mt-1`}
      />

      {previous && (
        <p className="mt-2 text-[11px] text-neutral-400">
          ส่งล่าสุด: {selfName} {selfScore} - {opponentName} {opponentScore}
        </p>
      )}

      <Button type="submit" className="mt-4 w-full">
        {previous ? "แก้ไขผล" : "ส่งผล"}
      </Button>
    </Card>
  );
}
