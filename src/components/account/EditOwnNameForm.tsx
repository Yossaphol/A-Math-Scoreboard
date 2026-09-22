"use client";

import { useState } from "react";
import { updateOwnPlayerName } from "@/lib/actions/link-requests";
import { Button } from "@/components/ui/Button";
import { inputClass, labelClass } from "@/components/ui/styles";

export function EditOwnNameForm({ name, nickname }: { name: string; nickname: string | null }) {
  const [editing, setEditing] = useState(false);

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="mt-1 text-xs text-neutral-400 underline decoration-dotted hover:text-neutral-600"
      >
        แก้ไขชื่อ/ชื่อเล่น
      </button>
    );
  }

  return (
    <form
      action={async (formData) => {
        await updateOwnPlayerName(formData);
        setEditing(false);
      }}
      className="mt-3 space-y-3"
    >
      <div>
        <label className={labelClass}>ชื่อ</label>
        <input name="name" defaultValue={name} required className={`${inputClass} mt-1`} />
      </div>
      <div>
        <label className={labelClass}>ชื่อเล่น</label>
        <input name="nickname" defaultValue={nickname ?? ""} className={`${inputClass} mt-1`} />
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm">
          บันทึก
        </Button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="rounded-lg px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-black/5"
        >
          ยกเลิก
        </button>
      </div>
    </form>
  );
}
