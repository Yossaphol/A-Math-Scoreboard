"use client";

import { useState } from "react";
import { adminSetMatchResult } from "@/lib/actions/match";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { useConfirmBeforeSubmit } from "./useConfirmBeforeSubmit";
import { ResultConfirmDialog } from "./ResultConfirmDialog";
import { ResultSummary } from "./ResultSummary";

type Report = { byName: string; player1Score: number; player2Score: number };

const isScore = (v: string) => /^\d+$/.test(v.trim());

export const ADMIN_SCORE_SAVED_EVENT = "admin-score-saved";

/**
 * Admin/Staff entering or correcting a match result (Round page and the "กรอกผล" page).
 * Typing fast is the point, so it guards against the classic slip — scores in the wrong
 * boxes — with a live "who won" line under the boxes and the same confirm step players get,
 * naming the round and table. Enter in the second box submits, Enter again confirms.
 */
export function AdminScoreForm({
  matchId,
  where,
  player1Name,
  player2Name,
  initial,
  reports = [],
  submitLabel = "บันทึกผล",
  subtle = false,
}: {
  matchId: string;
  // "Round 17 · Table 2" — shown in the confirm step.
  where: string;
  player1Name: string;
  player2Name: string;
  initial?: { player1Score: number; player2Score: number };
  // Each side's own report — shown with a one-tap "use this" when they don't agree.
  reports?: Report[];
  submitLabel?: string;
  subtle?: boolean;
}) {
  const [s1, setS1] = useState(initial ? String(initial.player1Score) : "");
  const [s2, setS2] = useState(initial ? String(initial.player2Score) : "");

  const { formId, confirming, error, onSubmit, cancel } = useConfirmBeforeSubmit(() => {
    if (!isScore(s1)) return `กรอกคะแนนของ ${player1Name}`;
    if (!isScore(s2)) return `กรอกคะแนนของ ${player2Name}`;
    return null;
  });

  async function save(formData: FormData) {
    await adminSetMatchResult(formData);
    // Lets a surrounding search (the "กรอกผล" page) reset itself for the next table.
    window.dispatchEvent(new CustomEvent(ADMIN_SCORE_SAVED_EVENT));
  }

  const n1 = Number(s1), n2 = Number(s2);
  const preview =
    isScore(s1) && isScore(s2)
      ? n1 === n2
        ? `เสมอ ${n1}–${n2}`
        : `${n1 > n2 ? player1Name : player2Name} ชนะ (+${Math.abs(n1 - n2)})`
      : null;

  const boxClass =
    "mt-1 block w-28 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-base font-semibold tabular-nums outline-none transition-colors focus:border-accent";

  return (
    <div className="space-y-2">
      {reports.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {reports.map((r) => (
            <span
              key={r.byName}
              className="inline-flex items-center gap-2 rounded-lg bg-warning/10 py-1 pl-2.5 pr-1 text-xs text-neutral-700"
            >
              {r.byName} ส่ง{" "}
              <b className="tabular-nums">
                {r.player1Score}–{r.player2Score}
              </b>
              <button
                type="button"
                onClick={() => {
                  setS1(String(r.player1Score));
                  setS2(String(r.player2Score));
                }}
                className="rounded-md border border-neutral-200 bg-white px-2 py-0.5 text-[11px] font-medium hover:border-neutral-300"
              >
                ใช้ผลนี้
              </button>
            </span>
          ))}
        </div>
      )}

      <form id={formId} action={save} onSubmit={onSubmit} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="matchId" value={matchId} />
        <label className="min-w-0 text-[11px] text-neutral-500">
          <span className="block max-w-28 truncate">{player1Name}</span>
          <input
            name="player1Score"
            inputMode="numeric"
            autoComplete="off"
            value={s1}
            onChange={(e) => setS1(e.target.value)}
            data-score-input
            className={boxClass}
          />
        </label>
        <label className="min-w-0 text-[11px] text-neutral-500">
          <span className="block max-w-28 truncate">{player2Name}</span>
          <input
            name="player2Score"
            inputMode="numeric"
            autoComplete="off"
            value={s2}
            onChange={(e) => setS2(e.target.value)}
            className={boxClass}
          />
        </label>
        <SubmitButton variant={subtle ? "secondary" : "primary"} pendingLabel="กำลังบันทึก...">
          {submitLabel}
        </SubmitButton>
      </form>

      <p className={`min-h-4 text-xs ${error ? "text-danger" : "text-neutral-500"}`}>
        {error ?? (preview && <span className="font-medium text-neutral-800">{preview}</span>)}
      </p>

      {confirming && (
        <ResultConfirmDialog formId={formId} onCancel={cancel}>
          <p className="mb-2 text-xs font-medium text-neutral-500">{where}</p>
          <ResultSummary player1={{ name: player1Name, score: n1 }} player2={{ name: player2Name, score: n2 }} />
        </ResultConfirmDialog>
      )}
    </div>
  );
}
