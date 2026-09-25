"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button, LinkButton } from "@/components/ui/Button";

/**
 * What a player sees once their side's result is in and the other side's isn't yet. This
 * used to be the same form again (pre-filled, "แก้ไขผล"), which read as "you're on the edit
 * page" — and on a shared phone the next player filled that form in, overwriting the first
 * player's side instead of adding their own, so the match could never confirm. Now it's an
 * explicit waiting state: the sent result, who it's waiting on, a way to hand the phone to
 * the other player, and editing only on request.
 *
 * Keyed by the submission's updatedAt by the caller, so sending an edit remounts it back out
 * of editing mode.
 */
export function SubmittedResultCard({
  summary,
  waitingFor,
  switchSideHref,
  editForm,
}: {
  summary: React.ReactNode;
  waitingFor: string;
  switchSideHref: string;
  editForm: React.ReactNode;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <div className="flex flex-col gap-2">
        {editForm}
        <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
          ยกเลิกการแก้ไข
        </Button>
      </div>
    );
  }

  return (
    <Card className="text-center">
      <div
        aria-hidden
        className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-success/10 text-lg text-success"
      >
        ✓
      </div>
      <p className="mt-2 text-sm font-semibold text-neutral-900">ส่งผลแล้ว</p>
      <div className="mt-4">{summary}</div>

      <p className="mt-4 flex items-center justify-center gap-2 text-sm text-neutral-700" role="status">
        <span aria-hidden className="h-2 w-2 animate-pulse rounded-full bg-warning" />
        รอ {waitingFor} ส่งผลเพื่อยืนยัน
      </p>
      <p className="mt-1 text-xs text-neutral-400">หน้านี้จะอัปเดตเองเมื่ออีกฝ่ายส่งผล</p>

      <div className="mt-5 flex flex-col gap-2">
        <LinkButton href={switchSideHref} variant="secondary" className="w-full">
          ให้ {waitingFor} ส่งผลจากเครื่องนี้
        </LinkButton>
        <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(true)}>
          แก้ไขผลที่ส่งไป
        </Button>
      </div>
    </Card>
  );
}
