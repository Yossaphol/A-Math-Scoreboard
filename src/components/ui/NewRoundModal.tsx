"use client";

import { useState } from "react";
import { Button } from "./Button";
import { ToggleGroup } from "./ToggleGroup";
import { inputClass, labelClass } from "./styles";

/** Corner "+ New Round" trigger — opens a form for Generate Pairing (spec §9/§10) in a modal
 * instead of a dedicated tab, since it's a one-off action rather than a page you browse. */
export function NewRoundModal({
  tournamentId,
  defaultMaximumScore,
  action,
}: {
  tournamentId: string;
  defaultMaximumScore: number;
  action: (formData: FormData) => void;
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
