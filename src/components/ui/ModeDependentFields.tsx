"use client";

import { useState } from "react";
import { Switch } from "./Switch";
import { ToggleGroup } from "./ToggleGroup";
import { inputClass, labelClass } from "./styles";

type Mode = "COMPETITION" | "PRACTICE";

/**
 * The Create Tournament fields whose defaults depend on the chosen mode:
 * - the Practice-only "set a password?" toggle (spec: never applies to Competition, so it only
 *   exists in the DOM — and only ever gets submitted — once the admin actually picks Practice);
 * - the player-limit / number-of-rounds toggles (spec §7, kept independent). Both are enforced
 *   (no adding past the limit, the Tournament completes after its last round), so they start
 *   ON for Competition, a fixed-size event, and OFF for Practice, which is usually open-ended.
 *   Keyed on mode so switching mode resets them to that mode's defaults.
 */
export function ModeDependentFields() {
  const [mode, setMode] = useState<Mode>("COMPETITION");
  const limitsOnByDefault = mode === "COMPETITION";

  return (
    <>
      <div>
        <label className={labelClass}>โหมดการแข่งขัน</label>
        <select
          name="mode"
          value={mode}
          onChange={(e) => setMode(e.target.value as Mode)}
          className={`${inputClass} mt-1`}
        >
          <option value="COMPETITION">การแข่งขันจริง</option>
          <option value="PRACTICE">โหมดฝึกซ้อม</option>
        </select>
      </div>

      {mode === "PRACTICE" && (
        <div className="rounded-xl border border-neutral-200 bg-white/40 p-4">
          <Switch
            name="setPin"
            label="ตั้งรหัสผ่าน? (ระบบสุ่มรหัสให้ กันคนนอกดูประวัติการฝึกซ้อม)"
          />
        </div>
      )}

      <ToggleGroup
        key={`players-${mode}`}
        name="setPlayerLimit"
        label="กำหนดจำนวนผู้เล่นล่วงหน้า"
        defaultChecked={limitsOnByDefault}
      >
        <label className={labelClass}>จำนวนผู้เล่น (ครบแล้วจะเพิ่มผู้เล่นไม่ได้)</label>
        <input name="maxPlayers" type="number" min={1} required defaultValue={24} className={`${inputClass} mt-1`} />
      </ToggleGroup>

      <ToggleGroup
        key={`rounds-${mode}`}
        name="setNumberOfGames"
        label="กำหนดจำนวนรอบการแข่งขันล่วงหน้า"
        defaultChecked={limitsOnByDefault}
      >
        <label className={labelClass}>จำนวนรอบการแข่งขัน (แข่งครบแล้ว Tournament จะจบอัตโนมัติ)</label>
        <input name="numberOfGames" type="number" min={1} required defaultValue={6} className={`${inputClass} mt-1`} />
      </ToggleGroup>
    </>
  );
}
