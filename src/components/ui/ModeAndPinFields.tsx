"use client";

import { useState } from "react";
import { Switch } from "./Switch";
import { inputClass, labelClass } from "./styles";

/**
 * Mode select + the Practice-only "set a password?" toggle (spec: never applies to
 * Competition, so it only exists in the DOM — and only ever gets submitted — once the admin
 * actually picks Practice).
 */
export function ModeAndPinFields() {
  const [mode, setMode] = useState<"COMPETITION" | "PRACTICE">("COMPETITION");

  return (
    <>
      <div>
        <label className={labelClass}>โหมดการแข่งขัน</label>
        <select
          name="mode"
          value={mode}
          onChange={(e) => setMode(e.target.value as "COMPETITION" | "PRACTICE")}
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
    </>
  );
}
