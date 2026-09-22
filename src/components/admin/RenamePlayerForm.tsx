"use client";

import { useState } from "react";
import { renameGlobalPlayer } from "@/lib/actions/global-players";
import { Button } from "@/components/ui/Button";
import { inputClass } from "@/components/ui/styles";

export function RenamePlayerForm({
  globalPlayerId,
  name,
  nickname,
}: {
  globalPlayerId: number;
  name: string;
  nickname: string | null;
}) {
  const [editing, setEditing] = useState(false);

  if (!editing) {
    return (
      <div className="flex items-center gap-2">
        <span>
          {name}
          {nickname && <span className="ml-2 text-xs text-neutral-500">{nickname}</span>}
        </span>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-xs text-neutral-400 underline decoration-dotted hover:text-neutral-600"
        >
          แก้ไข
        </button>
      </div>
    );
  }

  return (
    <form
      action={async (formData) => {
        await renameGlobalPlayer(formData);
        setEditing(false);
      }}
      className="flex flex-wrap items-center gap-1.5"
    >
      <input type="hidden" name="globalPlayerId" value={globalPlayerId} />
      <input
        name="name"
        defaultValue={name}
        required
        className={`${inputClass} w-32 py-1`}
        placeholder="ชื่อ"
      />
      <input
        name="nickname"
        defaultValue={nickname ?? ""}
        className={`${inputClass} w-24 py-1`}
        placeholder="ชื่อเล่น"
      />
      <Button type="submit" size="sm">
        บันทึก
      </Button>
      <button
        type="button"
        onClick={() => setEditing(false)}
        className="text-xs text-neutral-400 hover:text-neutral-600"
      >
        ยกเลิก
      </button>
    </form>
  );
}
