"use client";

import { useEffect, useRef, useState } from "react";
import { AlertIconTile } from "./AlertIcon";
import { clearNotifications, markNotificationsRead, useAlertState } from "./store";
import { setRefereeSoundMuted, useRefereeSoundMuted } from "./referee-sound-pref";
import { Switch } from "@/components/ui/Switch";
import { InboxList } from "@/components/account/InboxList";
import { markNotificationsRead as markInboxRead } from "@/lib/actions/notifications";
import type { InboxItem } from "@/lib/notifications";

const timeFormat = new Intl.DateTimeFormat("th-TH", { hour: "2-digit", minute: "2-digit" });
const dateFormat = new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short" });

function formatWhen(ts: number) {
  const d = new Date(ts);
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay ? timeFormat.format(d) : `${dateFormat.format(d)} ${timeFormat.format(d)}`;
}

/**
 * Every alert this device has shown, newest first — so one that timed out (or was closed
 * in a hurry) can still be read afterwards. Kept per device in localStorage: players at a
 * table have no account to tie a server-side inbox to.
 */
export function NotificationBell({
  className = "",
  align = "right",
  inbox,
}: {
  className?: string;
  // Stored notifications for this account (Staff invites, replies) — shown above this
  // device's alert history.
  inbox?: { items: InboxItem[]; unread: number };
  // Which edge the panel lines up with — "left" where the bell sits near the left of the
  // screen (the admin sidebar), so the panel doesn't run off it.
  align?: "left" | "right";
}) {
  const { history, lastReadAt } = useAlertState();
  const refereeSoundMuted = useRefereeSoundMuted();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const unread = history.filter((h) => h.createdAt > lastReadAt).length + (inbox?.unread ?? 0);

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

  function toggle() {
    if (!open) {
      markNotificationsRead();
      if (inbox?.unread) void markInboxRead();
    }
    setOpen((o) => !o);
  }

  return (
    <div className={className}>
      <div ref={ref} className="relative">
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-label={unread ? `การแจ้งเตือน (${unread} ใหม่)` : "การแจ้งเตือน"}
          className="relative flex size-9 items-center justify-center rounded-full border border-neutral-200 bg-white/80 text-neutral-600 transition-colors hover:border-neutral-300 hover:text-neutral-900"
        >
          <svg viewBox="0 0 24 24" fill="none" className="size-[18px]" aria-hidden="true">
            <path
              d="M6 8a6 6 0 1112 0c0 7 3 9 3 9H3s3-2 3-9zM10.3 21a1.94 1.94 0 003.4 0"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex min-w-[18px] items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold leading-[18px] text-white">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>

        {open && (
          <div
            className={`absolute ${align === "left" ? "left-0" : "right-0"} top-full z-50 mt-2 w-[min(340px,calc(100vw-2rem))] overflow-hidden rounded-2xl bg-white shadow-[0_10px_30px_-12px_rgba(16,24,40,0.25),0_2px_6px_rgba(16,24,40,0.06)] ring-1 ring-black/[0.05]`}
          >
            <div className="flex items-center justify-between border-b border-neutral-200/70 px-4 py-3">
              <p className="text-sm font-semibold text-neutral-900">การแจ้งเตือน</p>
              {history.length > 0 && (
                <button
                  type="button"
                  onClick={clearNotifications}
                  className="text-xs text-neutral-500 hover:text-neutral-900"
                >
                  ล้างทั้งหมด
                </button>
              )}
            </div>
            {inbox && inbox.items.length > 0 && (
              <div className="border-b border-neutral-200/70">
                <p className="px-4 pt-3 text-[11px] font-medium uppercase tracking-wide text-neutral-400">สำหรับคุณ</p>
                <div className="max-h-64 overflow-y-auto px-1">
                  <InboxList items={inbox.items} onNavigate={() => setOpen(false)} />
                </div>
              </div>
            )}
            <div className="border-b border-neutral-200/70 px-4 py-3">
              <Switch
                label="เสียงเรียกกรรมการ"
                checked={!refereeSoundMuted}
                onChange={(on) => setRefereeSoundMuted(!on)}
              />
              <p className="mt-1 text-[11px] text-neutral-400">
                {refereeSoundMuted ? "ปิดเสียงไว้ — ยังมี popup แจ้งเตือนเหมือนเดิม" : "ดังจนกว่าจะกดรับเรื่องหรือปิด"} · เฉพาะเครื่องนี้
              </p>
            </div>
            {history.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-neutral-400">ยังไม่มีการแจ้งเตือน</p>
            ) : (
              <ul className="max-h-[60vh] divide-y divide-neutral-200/60 overflow-y-auto">
                {history.map((n) => (
                  <li key={n.id} className="flex gap-3 px-4 py-3">
                    <AlertIconTile type={n.type} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="truncate text-sm font-medium text-neutral-900">{n.title}</p>
                        <span className="shrink-0 text-[11px] text-neutral-400">{formatWhen(n.createdAt)}</span>
                      </div>
                      {n.description && <p className="mt-0.5 whitespace-pre-line text-xs leading-relaxed text-neutral-500">{n.description}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
