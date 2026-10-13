"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { matchSearch, type MatchSearchKey } from "@/lib/match-search";
import { inputClass } from "@/components/ui/styles";
import { ADMIN_SCORE_SAVED_EVENT } from "./AdminScoreForm";

export type MatchSearchRow = { id: string; key: MatchSearchKey; node: React.ReactNode };

/**
 * A round's matches with one search box over them (see lib/match-search.ts for what it
 * accepts). Cards are rendered on the server; typing only filters them here, so nothing
 * waits on a round trip. While searching, finished matches are included too (to correct
 * one); otherwise they stay folded away below the ones still in play.
 */
export function MatchSearchList({
  open,
  done = [],
  between,
  doneLabel = "ยืนยันผลแล้ว",
  initialQuery = "",
  autoFocus = false,
  focusShortcut = false,
}: {
  open: MatchSearchRow[];
  done?: MatchSearchRow[];
  // Rendered between the open and the folded-away lists when not searching (Round page tools).
  between?: React.ReactNode;
  doneLabel?: string;
  initialQuery?: string;
  autoFocus?: boolean;
  // Keyboard-first mode (the "กรอกผล" page): "/" jumps to the search box from anywhere, and
  // after a result is saved the search clears and takes focus again for the next table.
  focusShortcut?: boolean;
}) {
  const [query, setQuery] = useState(initialQuery);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const test = matchSearch(query);
  const results = test ? [...open, ...done].filter((r) => test(r.key)) : null;

  useEffect(() => {
    if (!focusShortcut) return;
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (e.key !== "/" || target.closest("input, textarea, select, [contenteditable]")) return;
      e.preventDefault();
      searchRef.current?.focus();
      searchRef.current?.select();
    }
    function onSaved() {
      setQuery("");
      searchRef.current?.focus();
    }
    document.addEventListener("keydown", onKey);
    window.addEventListener(ADMIN_SCORE_SAVED_EVENT, onSaved);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener(ADMIN_SCORE_SAVED_EVENT, onSaved);
    };
  }, [focusShortcut]);

  // Enter in the search box: straight into the first result's first score box.
  function jumpToFirst() {
    const first = listRef.current?.querySelector<HTMLInputElement>("[data-score-input]");
    first?.focus();
    first?.select();
  }

  return (
    <div>
      <div className="relative">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
          <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <input
          ref={searchRef}
          type="search"
          value={query}
          autoFocus={autoFocus}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              jumpToFirst();
            } else if (e.key === "Escape") {
              setQuery("");
            }
          }}
          placeholder="ค้นหา: เลขโต๊ะ, #เลขผู้เล่น, ชื่อ หรือชื่อเล่น"
          aria-label="ค้นหาคู่แข่งขัน"
          className={`${inputClass} !py-2.5 pl-9`}
        />
      </div>
      <p className="mb-3 mt-1.5 text-[11px] text-neutral-400">
        {results
          ? `พบ ${results.length} คู่ · Enter เพื่อไปกรอกคู่แรก · Esc ล้าง`
          : `ยังไม่จบ ${open.length} คู่${done.length ? ` · ยืนยันแล้ว ${done.length} คู่` : ""}`}
      </p>

      <div ref={listRef}>
        {results ? (
          results.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-neutral-200 bg-white/60 py-10 text-center text-sm text-neutral-500">
              ไม่พบคู่ที่ตรงกับ &quot;{query.trim()}&quot; — ลองเลขโต๊ะ, #เลขผู้เล่น หรือชื่อเล่น
            </p>
          ) : (
            <ul className="mb-6 space-y-3">
              {results.map((r) => (
                <Fragment key={r.id}>{r.node}</Fragment>
              ))}
            </ul>
          )
        ) : (
          <>
            {open.length > 0 && (
              <ul className="mb-6 space-y-3">
                {open.map((r) => (
                  <Fragment key={r.id}>{r.node}</Fragment>
                ))}
              </ul>
            )}
            {between}
            {done.length > 0 && (
              <details className="group mb-6">
                <summary className="cursor-pointer text-xs text-neutral-500 group-open:mb-2">
                  {doneLabel} ({done.length})
                </summary>
                <ul className="space-y-3">
                  {done.map((r) => (
                    <Fragment key={r.id}>{r.node}</Fragment>
                  ))}
                </ul>
              </details>
            )}
          </>
        )}
      </div>
    </div>
  );
}
