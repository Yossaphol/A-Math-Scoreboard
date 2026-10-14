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
  groups,
  defaultSplit,
  activeTotal,
}: {
  tournamentId: string;
  defaultMaximumScore: number;
  action: (formData: FormData) => void;
  // Practice-only: lets staff pick a subset of the roster to play this round (spec §7 — not
  // everyone has to play every round). Ignored for COMPETITION, which always pairs everyone.
  mode: TournamentMode;
  activePlayers: { id: string; tournamentPlayerNo: number; name: string }[];
  // The Tournament's pairing groups (ชาย / หญิง, ...). With any, the round can be split so each
  // group is paired among itself, each with its own method.
  groups: { id: string; name: string; activeCount: number }[];
  // Starts as the previous round was (split while groups were still apart, together after).
  defaultSplit: boolean;
  activeTotal: number;
}) {
  const [open, setOpen] = useState(false);
  const [split, setSplit] = useState(defaultSplit && groups.length > 0);

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

              {groups.length > 0 && (
                <fieldset>
                  <legend className={labelClass}>รอบนี้จับคู่แบบไหน</legend>
                  <div className="mt-1.5 grid grid-cols-2 gap-2">
                    <ModeCard
                      checked={!split}
                      onSelect={() => setSplit(false)}
                      title="รวมทุกคน"
                      count={`${activeTotal} คน`}
                      detail="ทุกกลุ่มเจอกันได้"
                    />
                    <ModeCard
                      checked={split}
                      onSelect={() => setSplit(true)}
                      title="แยกตามกลุ่ม"
                      count={groups.map((g) => `${g.name} ${g.activeCount}`).join(" · ")}
                      detail="เจอแค่คนในกลุ่มตัวเอง"
                    />
                  </div>
                  {split && <input type="hidden" name="splitByGroup" value="on" />}
                  <p className="mt-1.5 text-xs text-neutral-500">คะแนนสะสมนับรวมกันเสมอ ไม่ว่าเลือกแบบไหน</p>
                </fieldset>
              )}

              {split ? (
                groups.map((g) => (
                  <div key={g.id}>
                    <label className={labelClass}>
                      Pairing Method — {g.name}{" "}
                      <span className="font-normal text-neutral-400">({g.activeCount} คน)</span>
                    </label>
                    <PairingMethodSelect name={`groupMethod:${g.id}`} />
                  </div>
                ))
              ) : (
                <div>
                  <label className={labelClass}>Pairing Method</label>
                  <PairingMethodSelect name="pairingMethod" />
                </div>
              )}

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

function PairingMethodSelect({ name }: { name: string }) {
  return (
    <select name={name} defaultValue="SWISS" className={`${inputClass} mt-1`}>
      <option value="RANDOM">Random</option>
      <option value="SWISS">Swiss</option>
      <option value="KING_OF_THE_HILL">King of the Hill</option>
      <option value="ROUND_ROBIN">Round Robin</option>
    </select>
  );
}

function ModeCard({
  checked,
  onSelect,
  title,
  count,
  detail,
}: {
  checked: boolean;
  onSelect: () => void;
  title: string;
  count: string;
  detail: string;
}) {
  return (
    <label
      className={`flex cursor-pointer flex-col rounded-xl border px-3 py-2.5 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-neutral-900 ${
        checked ? "border-neutral-900 bg-neutral-900/[0.03]" : "border-neutral-200 hover:border-neutral-300"
      }`}
    >
      <input type="radio" name="pairingScope" checked={checked} onChange={onSelect} className="sr-only" />
      <span className="flex items-center gap-2 text-sm font-medium text-neutral-900">
        <span
          aria-hidden="true"
          className={`flex size-4 shrink-0 items-center justify-center rounded-full border ${
            checked ? "border-neutral-900" : "border-neutral-300"
          }`}
        >
          {checked && <span className="size-2 rounded-full bg-neutral-900" />}
        </span>
        {title}
      </span>
      <span className="mt-1 pl-6 text-xs font-medium tabular-nums text-neutral-700">{count}</span>
      <span className="pl-6 text-xs leading-snug text-neutral-500">{detail}</span>
    </label>
  );
}
