"use client";

import { useState } from "react";
import { createGlobalPlayer } from "@/lib/actions/global-players";
import { Button } from "@/components/ui/Button";
import { inputClass, labelClass } from "@/components/ui/styles";

export function AddGlobalPlayerModal() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        + เพิ่มผู้เล่น
      </Button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm px-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="surface w-full max-w-sm rounded-2xl p-6">
            <p className="text-sm font-semibold text-neutral-900">เพิ่มผู้เล่นใหม่</p>
            <form
              action={async (formData) => {
                await createGlobalPlayer(formData);
                setOpen(false);
              }}
              className="mt-4 space-y-4"
            >
              <div>
                <label className={labelClass}>ชื่อ</label>
                <input name="name" required autoFocus className={`${inputClass} mt-1`} />
              </div>
              <div>
                <label className={labelClass}>ชื่อเล่น (ถ้ามี)</label>
                <input name="nickname" className={`${inputClass} mt-1`} />
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
                  เพิ่มผู้เล่น
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
