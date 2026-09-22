"use client";

import { useId } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

const PRESETS = [10, 20, 50, 100];
const MAX_PAGE_SIZE = 500;

/** Row-count picker for a paginated table: a dropdown of common sizes, or type a custom
 * number in the box next to it — both just navigate to the same page with a new `pageSize`
 * (and reset back to page 1, since the old page number may no longer exist at the new size). */
export function PageSizeSelect({ value }: { value: number }) {
  const id = useId();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function navigate(pageSize: number) {
    const sp = new URLSearchParams(searchParams.toString());
    sp.set("pageSize", String(pageSize));
    sp.set("page", "1");
    router.push(`${pathname}?${sp.toString()}`);
  }

  return (
    <div className="flex shrink-0 items-center gap-3">
      <label htmlFor={id} className="text-sm text-neutral-500">
        แถวต่อหน้า
      </label>
      <select
        id={id}
        value={PRESETS.includes(value) ? value : ""}
        onChange={(e) => {
          if (e.target.value) navigate(Number(e.target.value));
        }}
        className="rounded-full border border-neutral-200 bg-white/70 py-1.5 pl-3 pr-8 text-sm outline-none focus:border-accent"
      >
        {PRESETS.map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
        <option value="">กำหนดเอง</option>
      </select>
      <input
        key={value}
        type="number"
        min={1}
        max={MAX_PAGE_SIZE}
        defaultValue={value}
        title="กำหนดจำนวนแถวต่อหน้าเอง"
        onKeyDown={(e) => {
          if (e.key !== "Enter") return;
          e.preventDefault();
          const n = Number((e.target as HTMLInputElement).value);
          if (n > 0) navigate(Math.min(MAX_PAGE_SIZE, n));
        }}
        onBlur={(e) => {
          const n = Number(e.target.value);
          if (n > 0 && n !== value) navigate(Math.min(MAX_PAGE_SIZE, n));
        }}
        className="w-16 rounded-full border border-neutral-200 bg-white/70 px-3 py-1.5 text-sm outline-none focus:border-accent"
      />
    </div>
  );
}
