"use client";

import { useEffect, useRef, useState } from "react";
import { useOnlineStaff } from "@/components/ui/alerts/presence-store";

/**
 * "● ออนไลน์ 3 คน" in the admin header: who has an admin screen open right now, i.e. who would
 * see (and, unless muted, hear) a referee call. Fed by the admin live stream; someone who
 * closes their screen drops off within about 45 seconds.
 */
export function OnlineStaffButton({ currentUserId, align = "left" }: { currentUserId: string; align?: "left" | "right" }) {
  const online = useOnlineStaff();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white/80 px-2.5 py-1 text-xs text-neutral-600 transition-colors hover:border-neutral-300 hover:text-neutral-900"
      >
        <span className={`size-2 rounded-full ${online?.length ? "bg-success" : "bg-neutral-300"}`} aria-hidden="true" />
        {online === null ? "ออนไลน์ …" : `ออนไลน์ ${online.length} คน`}
        <svg viewBox="0 0 24 24" fill="none" className={`size-3 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true">
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div
          className={`absolute ${align === "left" ? "left-0" : "right-0"} top-full z-50 mt-2 w-64 overflow-hidden rounded-2xl bg-white shadow-[0_10px_30px_-12px_rgba(16,24,40,0.25),0_2px_6px_rgba(16,24,40,0.06)] ring-1 ring-black/[0.05]`}
        >
          <p className="border-b border-neutral-200/70 px-4 py-2.5 text-xs font-semibold text-neutral-900">
            กรรมการที่เปิดจออยู่ตอนนี้
          </p>
          {!online || online.length === 0 ? (
            <p className="px-4 py-5 text-center text-xs text-neutral-400">
              {online === null ? "กำลังเช็ก…" : "ยังไม่มีใครเปิดจออยู่"}
            </p>
          ) : (
            <ul className="max-h-72 overflow-y-auto py-1">
              {online.map((p) => (
                <li key={p.id} className="flex items-center gap-2.5 px-4 py-2 text-sm">
                  <span className="size-2 shrink-0 rounded-full bg-success" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate text-neutral-800">
                    {p.name}
                    {p.id === currentUserId && <span className="text-neutral-400"> (คุณ)</span>}
                  </span>
                  {p.soundMuted && (
                    <span title="ปิดเสียงเรียกกรรมการไว้" aria-label="ปิดเสียงเรียกกรรมการไว้" className="text-neutral-400">
                      <svg viewBox="0 0 24 24" fill="none" className="size-4" aria-hidden="true">
                        <path
                          d="M11 5L6 9H3v6h3l5 4V5zM22 9l-6 6M16 9l6 6"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                  )}
                  <span
                    className={`shrink-0 rounded-full px-1.5 py-px text-[10px] font-medium ${
                      p.role === "ADMIN" ? "bg-danger/10 text-danger" : "bg-info/10 text-info"
                    }`}
                  >
                    {p.role === "ADMIN" ? "Admin" : "Staff"}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="border-t border-neutral-200/70 px-4 py-2 text-[11px] text-neutral-400">
            ปิดจอแล้วจะหายจากรายการภายใน ~45 วินาที
          </p>
        </div>
      )}
    </div>
  );
}
