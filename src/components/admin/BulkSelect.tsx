"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { bulkDeleteGlobalPlayers } from "@/lib/actions/global-players";
import { ConfirmSubmitButton } from "@/components/ui/ConfirmSubmitButton";

type Row = { id: number; name: string; tournamentCount: number };

type Ctx = {
  rows: Row[];
  selected: Set<number>;
  toggle: (id: number) => void;
  setAll: (on: boolean) => void;
  clear: () => void;
};

const BulkSelectContext = createContext<Ctx | null>(null);

function useBulkSelect() {
  const ctx = useContext(BulkSelectContext);
  if (!ctx) throw new Error("BulkSelect components must be inside <BulkSelectProvider>");
  return ctx;
}

/**
 * Checkbox selection for the Global Players table (current page only). The table itself stays
 * server-rendered — only the checkboxes and the action bar are client components sharing this
 * context. Selection of rows no longer on the page (after a delete or page change) is dropped.
 */
export function BulkSelectProvider({ rows, children }: { rows: Row[]; children: React.ReactNode }) {
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const onPage = new Set(rows.map((r) => r.id));
  const selected = new Set([...picked].filter((id) => onPage.has(id)));

  const value: Ctx = {
    rows,
    selected,
    toggle: (id) =>
      setPicked((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }),
    setAll: (on) => setPicked(on ? new Set(rows.map((r) => r.id)) : new Set()),
    clear: () => setPicked(new Set()),
  };
  return <BulkSelectContext.Provider value={value}>{children}</BulkSelectContext.Provider>;
}

export function SelectAllCheckbox() {
  const { rows, selected, setAll } = useBulkSelect();
  const ref = useRef<HTMLInputElement>(null);
  const all = rows.length > 0 && selected.size === rows.length;
  const some = selected.size > 0 && !all;

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = some;
  }, [some]);

  return (
    <input
      ref={ref}
      type="checkbox"
      checked={all}
      onChange={(e) => setAll(e.target.checked)}
      aria-label="เลือกทั้งหมดในหน้านี้"
      className="h-4 w-4 cursor-pointer accent-neutral-900"
    />
  );
}

export function RowCheckbox({ id, name }: { id: number; name: string }) {
  const { selected, toggle } = useBulkSelect();
  return (
    <input
      type="checkbox"
      checked={selected.has(id)}
      onChange={() => toggle(id)}
      aria-label={`เลือก ${name}`}
      className="h-4 w-4 cursor-pointer accent-neutral-900"
    />
  );
}

/** Appears once anything is selected: count, clear, and delete-selected with a confirm step. */
export function BulkActionBar() {
  const { rows, selected, clear } = useBulkSelect();
  if (selected.size === 0) return null;

  const chosen = rows.filter((r) => selected.has(r.id));
  const withHistory = chosen.filter((r) => r.tournamentCount > 0);
  const names = chosen
    .slice(0, 5)
    .map((r) => r.name)
    .join(", ");

  return (
    <div className="mb-3 flex flex-wrap items-center gap-3 rounded-xl border border-neutral-200 bg-white/80 px-4 py-2.5 text-sm">
      <span className="font-medium text-neutral-900">เลือกแล้ว {selected.size} คน</span>
      <button type="button" onClick={clear} className="text-xs text-neutral-500 hover:underline">
        ล้างที่เลือก
      </button>
      <form
        action={async (fd) => {
          await bulkDeleteGlobalPlayers(fd);
          clear();
        }}
        className="ml-auto"
      >
        {chosen.map((r) => (
          <input key={r.id} type="hidden" name="globalPlayerIds" value={r.id} />
        ))}
        <ConfirmSubmitButton
          label={`ลบที่เลือก (${selected.size})`}
          confirmTitle={`ลบผู้เล่น ${selected.size} คน?`}
          confirmMessage={
            `${names}${chosen.length > 5 ? ` และอีก ${chosen.length - 5} คน` : ""} จะถูกลบถาวร` +
            (withHistory.length > 0
              ? ` — ${withHistory.length} คนในนี้เคยลงแข่งแล้ว ทุก Match ที่เขาเคยเล่นจะถูกลบไปด้วย ซึ่งจะหายจากประวัติของคู่แข่งด้วยเช่นกัน`
              : "") +
            " (แก้คืนไม่ได้)"
          }
        />
      </form>
    </div>
  );
}
