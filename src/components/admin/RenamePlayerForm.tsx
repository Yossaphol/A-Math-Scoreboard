"use client";

import { useState } from "react";
import { renameGlobalPlayer } from "@/lib/actions/global-players";
import { Button, buttonBase, VARIANTS, SIZES } from "@/components/ui/Button";
import { inputClass, labelClass } from "@/components/ui/styles";

/** Lives inside the row's ActionMenu (⋯) — a trigger styled like the other menu items,
 * opening a small modal to edit name/nickname instead of expanding inline in the table row. */
export function RenamePlayerForm({
  globalPlayerId,
  name,
  nickname,
}: {
  globalPlayerId: number;
  name: string;
  nickname: string | null;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`${buttonBase} ${VARIANTS.secondary} ${SIZES.sm} w-full`}
      >
        แก้ไขชื่อ
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm px-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="surface w-full max-w-sm rounded-2xl p-6">
            <p className="text-sm font-semibold text-neutral-900">แก้ไขผู้เล่น</p>
            <form
              action={async (formData) => {
                await renameGlobalPlayer(formData);
                setOpen(false);
              }}
              className="mt-4 space-y-4"
            >
              <input type="hidden" name="globalPlayerId" value={globalPlayerId} />
              <div>
                <label className={labelClass}>ชื่อ</label>
                <input name="name" defaultValue={name} required autoFocus className={`${inputClass} mt-1`} />
              </div>
              <div>
                <label className={labelClass}>ชื่อเล่น (ถ้ามี)</label>
                <input name="nickname" defaultValue={nickname ?? ""} className={`${inputClass} mt-1`} />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-black/5"
                >
                  ยกเลิก
                </button>
                <Button type="submit" size="sm">
                  บันทึก
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
