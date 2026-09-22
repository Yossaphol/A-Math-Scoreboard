"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { logoutAction } from "@/lib/actions/auth";

function ChevronDownIcon({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={`size-3.5 shrink-0 text-neutral-400 transition-transform ${open ? "rotate-180" : ""}`}
      aria-hidden="true"
    >
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function UserMenu({ name, isStaffOrAdmin }: { name: string; isStaffOrAdmin: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const initial = name.trim().charAt(0).toUpperCase() || "?";

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
        aria-haspopup="menu"
        className="flex items-center gap-2 rounded-full border border-neutral-200 bg-white/80 py-1 pl-1 pr-2.5 text-sm text-neutral-900 transition-colors hover:border-neutral-300"
      >
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-xs font-semibold text-white">
          {initial}
        </span>
        <span className="max-w-[140px] truncate font-medium">{name}</span>
        <ChevronDownIcon open={open} />
      </button>

      {open && (
        <div
          role="menu"
          className="surface absolute right-0 top-full z-20 mt-2 w-60 overflow-hidden rounded-xl !p-1"
        >
          {isStaffOrAdmin && (
            <>
              <Link
                href="/admin"
                role="menuitem"
                onClick={() => setOpen(false)}
                className="block rounded-lg px-3 py-2 text-sm text-neutral-700 hover:bg-black/5"
              >
                ไปหน้า Admin
              </Link>
              <div className="my-1 h-px bg-neutral-100" />
            </>
          )}
          <Link
            href="/account#profile"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="block rounded-lg px-3 py-2 text-sm text-neutral-700 hover:bg-black/5"
          >
            แก้ไขข้อมูล/ผูกบัญชี Google
          </Link>
          <div className="my-1 h-px bg-neutral-100" />
          <form action={logoutAction}>
            <button
              type="submit"
              role="menuitem"
              className="block w-full rounded-lg px-3 py-2 text-left text-sm text-danger hover:bg-danger/5"
            >
              ออกจากระบบ
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
