"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { inputClass, labelClass } from "@/components/ui/styles";
import { validateWinnerScores, type Winner } from "./scoreEntryValidation";
import { useConfirmBeforeSubmit } from "./useConfirmBeforeSubmit";
import { ResultConfirmDialog } from "./ResultConfirmDialog";
import { ResultSummary } from "./ResultSummary";

// Spec §13 still applies: this is one of up to two independent reports of the SAME match,
// compared server-side (in submitMatchResult for the table-QR flow, submitSelfServiceResult
// for the self-service flow — both share the same resolveMatchSubmission engine) — only the
// input shape changed (winner/loser instead of self/opponent) to cut the fields a player has
// to fill in half. `action` and `extraHiddenFields` are generic so both flows can reuse this
// same winner-picker UI/validation without duplicating it.
export function ResultForm({
  action,
  extraHiddenFields,
  matchId,
  side,
  player1Name,
  player2Name,
  previous,
  opponentReport,
  meta,
  heading,
}: {
  action: (formData: FormData) => void;
  extraHiddenFields: Record<string, string>;
  matchId: string;
  side: "PLAYER1" | "PLAYER2";
  player1Name: string;
  player2Name: string;
  previous?: { player1Score: number; player2Score: number };
  // What the other side already reported for this match — shown so the player can tell which
  // game this card is about, and used to prefill the form (when `previous` isn't set) so
  // agreeing is a single tap.
  opponentReport?: { byName: string; player1Score: number; player2Score: number };
  // Small context line under the heading, e.g. when the match was started.
  meta?: string;
  heading?: string;
}) {
  const prefill = previous ?? opponentReport;
  const initialWinner: Winner | null = prefill
    ? prefill.player1Score === prefill.player2Score
      ? "TIE"
      : prefill.player1Score > prefill.player2Score
        ? "PLAYER1"
        : "PLAYER2"
    : null;
  const initialHigh = prefill ? Math.max(prefill.player1Score, prefill.player2Score) : undefined;
  const initialLow = prefill ? Math.min(prefill.player1Score, prefill.player2Score) : undefined;

  const [winner, setWinner] = useState<Winner | null>(initialWinner);
  const [winnerScore, setWinnerScore] = useState(initialHigh !== undefined ? String(initialHigh) : "");
  const [loserScore, setLoserScore] = useState(initialLow !== undefined ? String(initialLow) : "");
  const [tieScore, setTieScore] = useState(
    prefill && prefill.player1Score === prefill.player2Score ? String(prefill.player1Score) : ""
  );

  const player1Score =
    winner === "PLAYER1" ? winnerScore : winner === "PLAYER2" ? loserScore : tieScore;
  const player2Score =
    winner === "PLAYER2" ? winnerScore : winner === "PLAYER1" ? loserScore : tieScore;

  const { formId, confirming, error, onSubmit, cancel } = useConfirmBeforeSubmit(() =>
    validateWinnerScores(winner, winnerScore, loserScore, tieScore)
  );

  return (
    <Card as="form" id={formId} action={action} onSubmit={onSubmit}>
      <input type="hidden" name="matchId" value={matchId} />
      {Object.entries(extraHiddenFields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <input type="hidden" name="side" value={side} />
      <input type="hidden" name="player1Score" value={player1Score} />
      <input type="hidden" name="player2Score" value={player2Score} />

      {heading && <p className="text-sm font-medium text-neutral-900">{heading}</p>}
      {meta && <p className="mt-0.5 text-xs text-neutral-500">{meta}</p>}
      {opponentReport && (
        <p className="mt-3 rounded-lg bg-black/[0.03] px-3 py-2 text-xs text-neutral-600">
          <span className="font-medium text-neutral-800">{opponentReport.byName}</span> ส่งผลว่า:{" "}
          {describeResult(opponentReport, player1Name, player2Name)}
        </p>
      )}

      <p className={`${labelClass} ${heading ? "mt-3" : ""} block`}>ใครชนะ?</p>
      <div className="mt-1 grid grid-cols-3 gap-2">
        {(
          [
            ["PLAYER1", player1Name],
            ["PLAYER2", player2Name],
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

      <SubmitButton className="mt-4 w-full">
        {previous ? "แก้ไขผล" : opponentReport ? "ยืนยันผล" : "ส่งผล"}
      </SubmitButton>

      {confirming && (
        <ResultConfirmDialog formId={formId} onCancel={cancel}>
          <ResultSummary
            player1={{ name: player1Name, score: Number(player1Score) }}
            player2={{ name: player2Name, score: Number(player2Score) }}
          />
        </ResultConfirmDialog>
      )}
    </Card>
  );
}

function describeResult(
  r: { player1Score: number; player2Score: number },
  player1Name: string,
  player2Name: string
) {
  if (r.player1Score === r.player2Score) return `เสมอ ${r.player1Score} - ${r.player2Score}`;
  return r.player1Score > r.player2Score
    ? `${player1Name} ชนะ ${r.player1Score} - ${r.player2Score}`
    : `${player2Name} ชนะ ${r.player2Score} - ${r.player1Score}`;
}
