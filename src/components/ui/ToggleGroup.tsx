"use client";

import { useState } from "react";

/**
 * A Switch that also gates the input(s) below it: when off, they're wrapped in a disabled
 * `<fieldset>` (grayed out, not tabbable, not submitted as a real value) instead of staying
 * live while visually implying they don't matter.
 */
export function ToggleGroup({
  name,
  label,
  defaultChecked,
  children,
}: {
  name: string;
  label: string;
  defaultChecked?: boolean;
  children?: React.ReactNode;
}) {
  const [checked, setChecked] = useState(!!defaultChecked);

  return (
    <div className="rounded-xl border border-neutral-200 bg-white/40 p-4">
      <label className="flex cursor-pointer items-center justify-between gap-3">
        <span className="text-sm font-medium text-neutral-800">{label}</span>
        <span className="relative inline-flex shrink-0 items-center">
          <input
            type="checkbox"
            name={name}
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            className="peer sr-only"
          />
          <span className="h-6 w-11 rounded-full bg-neutral-200 transition-colors peer-checked:bg-neutral-900 peer-focus-visible:ring-2 peer-focus-visible:ring-accent peer-focus-visible:ring-offset-2" />
          <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
        </span>
      </label>
      {children && (
        <fieldset
          disabled={!checked}
          className={`m-0 mt-3 border-0 p-0 transition-opacity ${checked ? "" : "opacity-50"}`}
        >
          {children}
        </fieldset>
      )}
    </div>
  );
}
