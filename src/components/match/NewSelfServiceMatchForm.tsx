"use client";

import { useState } from "react";
import { startSelfServiceMatch } from "@/lib/actions/self-service";
import { validateWinnerScores } from "./scoreEntryValidation";
import { useConfirmBeforeSubmit } from "./useConfirmBeforeSubmit";
import { ResultConfirmDialog } from "./ResultConfirmDialog";
import { ResultSummary } from "./ResultSummary";
import { Card } from "@/components/ui/Card";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { inputClass, labelClass } from "@/components/ui/styles";

type LocalWinner = "ME" | "OPPONENT" | "TIE";

// Starts a brand-new self-service ad-hoc match: pick an opponent, pick a winner, enter
// scores. Reuses the same winner/score validation rule as ResultForm (via
// validateWinnerScores) but keeps its own JSX, since it also needs an opponent picker that
// ResultForm (confirming an already-existing match) has no use for.
export function NewSelfServiceMatchForm({
  token,
  selfPlayerId,
  selfName,
  opponents,
}: {
  token: string;
  selfPlayerId: string;
  selfName: string;
  opponents: { id: string; name: string }[];
}) {
  const [opponentId, setOpponentId] = useState(opponents[0]?.id ?? "");
  const [winner, setWinner] = useState<LocalWinner | null>(null);
  const [winnerScore, setWinnerScore] = useState("");
  const [loserScore, setLoserScore] = useState("");
  const [tieScore, setTieScore] = useState("");

  // "ME" / "OPPONENT" map onto player1/player2 the same way startSelfServiceMatch always
  // stores selfPlayerId as player1Id.
  const player1Score = winner === "ME" ? winnerScore : winner === "OPPONENT" ? loserScore : tieScore;
  const player2Score = winner === "OPPONENT" ? winnerScore : winner === "ME" ? loserScore : tieScore;

  const { formId, confirming, error, onSubmit, cancel } = useConfirmBeforeSubmit(() =>
    validateWinnerScores(
      winner === "ME" ? "PLAYER1" : winner === "OPPONENT" ? "PLAYER2" : winner,
      winnerScore,
      loserScore,
      tieScore
    )
  );

  const opponentName = opponents.find((o) => o.id === opponentId)?.name ?? "";

  return (
    <Card as="form" id={formId} action={startSelfServiceMatch} onSubmit={onSubmit}>
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="selfPlayerId" value={selfPlayerId} />
      <input type="hidden" name="opponentPlayerId" value={opponentId} />
      <input type="hidden" name="player1Score" value={player1Score} />
      <input type="hidden" name="player2Score" value={player2Score} />

      <label className={labelClass}>คู่แข่ง</label>
      <select
        value={opponentId}
        onChange={(e) => setOpponentId(e.target.value)}
        className={`${inputClass} mt-1`}
      >
        {opponents.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>

      <p className={`${labelClass} mt-3 block`}>ใครชนะ?</p>
      <div className="mt-1 grid grid-cols-3 gap-2">
        {(
          [
            ["ME", selfName],
            ["OPPONENT", opponentName || "คู่แข่ง"],
            ["TIE", "เสมอ"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setWinner(value)}
            className={`truncate rounded-lg border px-2 py-2 text-sm transition-colors ${
              winner === value
                ? "border-accent bg-accent/10 font-medium text-accent"
                : "border-neutral-200 text-neutral-600 hover:border-neutral-300"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {winner === "TIE" ? (
        <div className="mt-3">
          <label className={labelClass}>คะแนน (เท่ากันทั้งคู่)</label>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            required
            value={tieScore}
            onChange={(e) => setTieScore(e.target.value)}
            className={`${inputClass} mt-1`}
          />
        </div>
      ) : winner ? (
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>คะแนนผู้ชนะ</label>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              required
              value={winnerScore}
              onChange={(e) => setWinnerScore(e.target.value)}
              className={`${inputClass} mt-1`}
            />
          </div>
          <div>
            <label className={labelClass}>คะแนนผู้แพ้</label>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              required
              value={loserScore}
              onChange={(e) => setLoserScore(e.target.value)}
              className={`${inputClass} mt-1`}
            />
          </div>
        </div>
      ) : null}

      {error && <p className="mt-2 text-xs text-danger">{error}</p>}

      <SubmitButton className="mt-4 w-full" disabled={!opponentId} pendingLabel="กำลังบันทึก...">
        บันทึกผล
      </SubmitButton>

      {confirming && (
        <ResultConfirmDialog formId={formId} onCancel={cancel}>
          <ResultSummary
            player1={{ name: selfName, score: Number(player1Score) }}
            player2={{ name: opponentName, score: Number(player2Score) }}
          />
        </ResultConfirmDialog>
      )}
    </Card>
  );
}
