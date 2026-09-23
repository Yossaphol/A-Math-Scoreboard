"use client";

import { useState } from "react";
import { Button } from "./Button";
import { ToggleGroup } from "./ToggleGroup";
import { inputClass, labelClass } from "./styles";
import type { TournamentMode } from "@/generated/prisma/enums";

/** Corner "+ New Round" trigger — opens a form for Generate Pairing (spec §9/§10) in a modal
 * instead of a dedicated tab, since it's a one-off action rather than a page you browse. */
export function NewRoundModal({
  tournamentId,
  defaultMaximumScore,
  action,
  mode,
  activePlayers,
}: {
  tournamentId: string;
  defaultMaximumScore: number;
  action: (formData: FormData) => void;
  // Practice-only: lets staff pick a subset of the roster to play this round (spec §7 — not
  // everyone has to play every round). Ignored for COMPETITION, which always pairs everyone.
  mode: TournamentMode;
  activePlayers: { id: string; tournamentPlayerNo: number; name: string }[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        + New Round
      </Button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm px-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="surface w-full max-w-sm rounded-2xl p-6">
            <p className="text-sm font-semibold text-neutral-900">Round ใหม่</p>
            <form action={action} className="mt-4 space-y-4">
              <input type="hidden" name="tournamentId" value={tournamentId} />

              <div>
                <label className={labelClass}>Pairing Method</label>
                <select name="pairingMethod" defaultValue="SWISS" className={`${inputClass} mt-1`}>
                  <option value="RANDOM">Random</option>
                  <option value="SWISS">Swiss</option>
                  <option value="KING_OF_THE_HILL">King of the Hill</option>
                  <option value="ROUND_ROBIN">Round Robin</option>
                </select>
              </div>

              <ToggleGroup name="maximumScoreEnabled" label="Maximum Score" defaultChecked>
                <input
                  name="maximumScore"
                  type="number"
                  min={1}
                  defaultValue={defaultMaximumScore}
                  className={inputClass}
                />
              </ToggleGroup>

              {mode === "PRACTICE" && (
                <div>
                  <p className={labelClass}>ผู้เล่นที่จะจับคู่รอบนี้ (ค่าเริ่มต้น: ทุกคน)</p>
                  <div className="mt-1 max-h-40 space-y-1 overflow-y-auto rounded-lg border border-neutral-200 p-2">
                    {activePlayers.map((p) => (
                      <label key={p.id} className="flex items-center gap-2 text-sm">
                        <input type="checkbox" name="playerIds" value={p.id} defaultChecked />
                        {p.name} <span className="text-neutral-400">#{p.tournamentPlayerNo}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-black/5"
                >
                  ยกเลิก
                </button>
                <Button type="submit" size="sm">
                  Generate Pairing
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
