"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { logoutAction } from "@/lib/actions/auth";
import { clearNotifications, markNotificationsRead } from "@/lib/actions/notifications";
import type { InboxItem } from "@/lib/notifications";
import { InboxList } from "./InboxList";

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

export function UserMenu({
  name,
  isStaffOrAdmin,
  inbox,
  staffTournaments,
}: {
  name: string;
  isStaffOrAdmin: boolean;
  inbox: { items: InboxItem[]; unread: number };
  // Tournaments this person is active Staff on — one tap to each.
  staffTournaments: { id: string; name: string }[];
}) {
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
        onClick={() => {
          // Opening the menu counts as having seen what's new.
          if (!open && inbox.unread > 0) void markNotificationsRead();
          setOpen((o) => !o);
        }}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={inbox.unread ? `${name} — การแจ้งเตือนใหม่ ${inbox.unread} รายการ` : undefined}
        className="relative flex items-center gap-2 rounded-full border border-neutral-200 bg-white/80 py-1 pl-1 pr-2.5 text-sm text-neutral-900 transition-colors hover:border-neutral-300"
      >
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-xs font-semibold text-white">
          {initial}
        </span>
        {inbox.unread > 0 && (
          <span className="absolute -left-1 -top-1 flex min-w-[18px] items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold leading-[18px] text-white ring-2 ring-white">
            {inbox.unread > 9 ? "9+" : inbox.unread}
          </span>
        )}
        <span className="max-w-[140px] truncate font-medium">{name}</span>
        <ChevronDownIcon open={open} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-xl bg-white p-1 shadow-[0_10px_30px_-12px_rgba(16,24,40,0.25),0_2px_6px_rgba(16,24,40,0.06)] ring-1 ring-black/[0.05]"
        >
          <div className="flex items-center justify-between px-3 pb-1 pt-2">
            <p className="text-xs font-semibold text-neutral-900">การแจ้งเตือน</p>
            {inbox.items.some((n) => n.invite?.status !== "INVITED") && (
              <button
                type="button"
                onClick={() => void clearNotifications()}
                className="text-[11px] text-neutral-500 hover:text-neutral-900"
              >
                ล้างทั้งหมด
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            <InboxList items={inbox.items} onNavigate={() => setOpen(false)} />
          </div>
          <div className="my-1 h-px bg-neutral-100" />
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
              {staffTournaments.map((t) => (
                <Link
                  key={t.id}
                  href={`/admin/tournaments/${t.id}`}
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className="block truncate rounded-lg px-3 py-2 text-sm text-neutral-700 hover:bg-black/5"
                >
                  <span className="text-neutral-400">Staff ·</span> {t.name}
                </Link>
              ))}
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
