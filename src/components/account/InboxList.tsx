"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { InboxItem } from "@/lib/notifications";
import { deleteNotification, respondStaffInvite } from "@/lib/actions/notifications";
import { SubmitButton } from "@/components/ui/SubmitButton";

const timeFormat = new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

const INVITE_STATE: Record<string, string> = {
  ACTIVE: "ตอบรับแล้ว",
  DECLINED: "ปฏิเสธแล้ว",
  REVOKED: "คำเชิญถูกยกเลิก",
};

/**
 * Stored notifications for the signed-in person (user menu on the public site, bell in the
 * admin shell). A Staff invite is answered right here; anything else links to where it's about.
 */
export function InboxList({ items: all, onNavigate }: { items: InboxItem[]; onNavigate?: () => void }) {
  // Hidden right away on ✕; the server copy follows on the next render.
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();
  const items = all.filter((n) => !removed.has(n.id));

  function remove(id: string) {
    setRemoved((prev) => new Set(prev).add(id));
    startTransition(() => deleteNotification(id));
  }

  if (items.length === 0) {
    return <p className="px-3 py-4 text-center text-xs text-neutral-400">ยังไม่มีการแจ้งเตือน</p>;
  }
  return (
    <ul className="divide-y divide-neutral-100">
      {items.map((n) => {
        const pendingInvite = n.invite?.status === "INVITED";
        const content = (
          <>
            <div className="flex items-start gap-2">
              {n.unread && <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-accent" aria-label="ยังไม่อ่าน" />}
              <p className="min-w-0 flex-1 text-sm font-medium text-neutral-900">{n.title}</p>
            </div>
            {n.body && <p className="mt-0.5 text-xs leading-relaxed text-neutral-500">{n.body}</p>}
            <p className="mt-1 text-[11px] text-neutral-400">{timeFormat.format(new Date(n.createdAt))}</p>
          </>
        );
        return (
          <li key={n.id} className="group relative px-3 py-2.5 pr-9">
            {!pendingInvite && (
              <button
                type="button"
                onClick={() => remove(n.id)}
                aria-label={`ลบการแจ้งเตือน: ${n.title}`}
                title="ลบ"
                className="absolute right-1.5 top-2 flex size-7 items-center justify-center rounded-md text-neutral-400 transition-colors hover:bg-black/5 hover:text-neutral-700 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
              >
                <svg viewBox="0 0 24 24" fill="none" className="size-3.5" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            )}
            {n.href && !n.invite ? (
              <Link href={n.href} onClick={onNavigate} className="-mx-1 block rounded-lg px-1 hover:bg-black/[0.03]">
                {content}
              </Link>
            ) : (
              content
            )}
            {n.invite &&
              (pendingInvite ? (
                <div className="mt-2 flex gap-2">
                  {(["accept", "decline"] as const).map((decision) => (
                    <form key={decision} action={respondStaffInvite} className="flex-1">
                      <input type="hidden" name="assignmentId" value={n.invite!.assignmentId} />
                      <input type="hidden" name="decision" value={decision} />
                      <SubmitButton
                        size="sm"
                        variant={decision === "accept" ? "primary" : "secondary"}
                        pendingLabel="กำลังบันทึก..."
                        className="w-full"
                      >
                        {decision === "accept" ? "ยืนยัน" : "ปฏิเสธ"}
                      </SubmitButton>
                    </form>
                  ))}
                </div>
              ) : (
                <p className="mt-1.5 text-xs text-neutral-500">
                  {INVITE_STATE[n.invite.status] ?? ""}
                  {n.invite.status === "ACTIVE" && (
                    <>
                      {" · "}
                      <Link
                        href={`/admin/tournaments/${n.invite.tournamentId}`}
                        onClick={onNavigate}
                        className="font-medium text-neutral-800 hover:underline"
                      >
                        ไปจัดการ Tournament →
                      </Link>
                    </>
                  )}
                </p>
              ))}
          </li>
        );
      })}
    </ul>
  );
}
