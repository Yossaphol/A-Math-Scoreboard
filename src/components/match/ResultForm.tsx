"use client";

import { useState, type FormEvent } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { inputClass, labelClass } from "@/components/ui/styles";
import { validateWinnerScores, type Winner } from "./scoreEntryValidation";

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
  heading,
}: {
  action: (formData: FormData) => void;
  extraHiddenFields: Record<string, string>;
  matchId: string;
  side: "PLAYER1" | "PLAYER2";
  player1Name: string;
  player2Name: string;
  previous?: { player1Score: number; player2Score: number };
  heading?: string;
}) {
  const initialWinner: Winner | null = previous
    ? previous.player1Score === previous.player2Score
      ? "TIE"
      : previous.player1Score > previous.player2Score
        ? "PLAYER1"
        : "PLAYER2"
    : null;
  const initialHigh = previous ? Math.max(previous.player1Score, previous.player2Score) : undefined;
  const initialLow = previous ? Math.min(previous.player1Score, previous.player2Score) : undefined;

  const [winner, setWinner] = useState<Winner | null>(initialWinner);
  const [winnerScore, setWinnerScore] = useState(initialHigh !== undefined ? String(initialHigh) : "");
  const [loserScore, setLoserScore] = useState(initialLow !== undefined ? String(initialLow) : "");
  const [tieScore, setTieScore] = useState(
    previous && previous.player1Score === previous.player2Score ? String(previous.player1Score) : ""
  );
  const [error, setError] = useState<string | null>(null);

  const player1Score =
    winner === "PLAYER1" ? winnerScore : winner === "PLAYER2" ? loserScore : tieScore;
  const player2Score =
    winner === "PLAYER2" ? winnerScore : winner === "PLAYER1" ? loserScore : tieScore;

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    const message = validateWinnerScores(winner, winnerScore, loserScore, tieScore);
    if (message) {
      e.preventDefault();
      setError(message);
      return;
    }
    setError(null);
  }

  return (
    <Card as="form" action={action} onSubmit={handleSubmit}>
      <input type="hidden" name="matchId" value={matchId} />
      {Object.entries(extraHiddenFields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <input type="hidden" name="side" value={side} />
      <input type="hidden" name="player1Score" value={player1Score} />
      <input type="hidden" name="player2Score" value={player2Score} />

      {heading && <p className="text-sm font-medium text-neutral-900">{heading}</p>}

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

      <Button type="submit" className="mt-4 w-full">
        {previous ? "แก้ไขผล" : "ส่งผล"}
      </Button>
    </Card>
  );
}
