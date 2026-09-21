"use client";

import { useState, useTransition } from "react";
import { swapPreviewPlayers } from "@/lib/actions/pairing";
import { Card } from "./Card";
import { Badge } from "./Badge";

export type PreviewSlot = {
  playerId: string;
  tournamentPlayerNo: number;
  name: string;
  isFirst: boolean;
  isSecond: boolean;
  wins: number;
  ties: number;
  losses: number;
  diff: number;
};

export type PreviewMatch = {
  id: string;
  player1: PreviewSlot;
  player2: PreviewSlot | null; // null = Bye
};

/**
 * Swap two seated players by dragging one onto another (desktop) or tapping one then the
 * other (touch — native HTML5 drag doesn't fire on touch devices, so this doubles as the
 * mobile-friendly path rather than a separate reimplementation).
 */
export function RoundPreviewBoard({ roundId, matches }: { roundId: string; matches: PreviewMatch[] }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function swap(targetId: string) {
    const sourceId = selected;
    setSelected(null);
    setDragOver(null);
    if (!sourceId || sourceId === targetId) return;

    const fd = new FormData();
    fd.set("roundId", roundId);
    fd.set("playerAId", sourceId);
    fd.set("playerBId", targetId);
    startTransition(() => {
      swapPreviewPlayers(fd);
    });
  }

  function handleClick(playerId: string) {
    if (selected === playerId) {
      setSelected(null);
    } else if (selected) {
      swap(playerId);
    } else {
      setSelected(playerId);
    }
  }

  return (
    <ul className="space-y-3">
      {matches.map((m) => (
        <li key={m.id}>
          <Card padding="p-4" className={isPending ? "opacity-60 transition-opacity" : "transition-opacity"}>
            <div className="flex items-center justify-between gap-2 sm:gap-4">
              <PlayerCard
                slot={m.player1}
                selected={selected === m.player1.playerId}
                dragOver={dragOver === m.player1.playerId}
                onSelect={() => handleClick(m.player1.playerId)}
                onDragStart={() => setSelected(m.player1.playerId)}
                onDragOverSlot={() => setDragOver(m.player1.playerId)}
                onDragLeaveSlot={() => setDragOver((d) => (d === m.player1.playerId ? null : d))}
                onDrop={() => swap(m.player1.playerId)}
              />
              <span className="shrink-0 text-xs text-neutral-400">VS</span>
              {m.player2 ? (
                <PlayerCard
                  slot={m.player2}
                  selected={selected === m.player2.playerId}
                  dragOver={dragOver === m.player2.playerId}
                  onSelect={() => handleClick(m.player2!.playerId)}
                  onDragStart={() => setSelected(m.player2!.playerId)}
                  onDragOverSlot={() => setDragOver(m.player2!.playerId)}
                  onDragLeaveSlot={() => setDragOver((d) => (d === m.player2!.playerId ? null : d))}
                  onDrop={() => swap(m.player2!.playerId)}
                />
              ) : (
                <span className="flex-1 text-right text-sm font-medium text-neutral-500">BYE</span>
              )}
            </div>
          </Card>
        </li>
      ))}
    </ul>
  );
}

function PlayerCard({
  slot,
  selected,
  dragOver,
  onSelect,
  onDragStart,
  onDragOverSlot,
  onDragLeaveSlot,
  onDrop,
}: {
  slot: PreviewSlot;
  selected: boolean;
  dragOver: boolean;
  onSelect: () => void;
  onDragStart: () => void;
  onDragOverSlot: () => void;
  onDragLeaveSlot: () => void;
  onDrop: () => void;
}) {
  return (
    <div
      draggable
      role="button"
      tabIndex={0}
      title="ลาก หรือแตะเพื่อเลือก แล้วแตะอีกคนเพื่อสลับ"
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      onDragOver={(e) => {
        e.preventDefault();
        onDragOverSlot();
      }}
      onDragLeave={onDragLeaveSlot}
      onDrop={(e) => {
        e.preventDefault();
        onDrop();
      }}
      className={`min-w-0 flex-1 cursor-grab select-none rounded-lg border p-2 transition-colors active:cursor-grabbing ${
        selected ? "border-accent bg-accent/10" : "border-transparent"
      } ${dragOver && !selected ? "border-accent/60 bg-accent/5" : ""} hover:bg-black/[0.02]`}
    >
      <p className="truncate text-sm font-medium text-neutral-900">
        #{slot.tournamentPlayerNo} {slot.name}
      </p>
      <div className="mt-0.5 flex flex-wrap items-center gap-1">
        {slot.isFirst && <Badge variant="accent">FIRST</Badge>}
        {slot.isSecond && <Badge variant="neutral">SECOND</Badge>}
      </div>
      <p className="mt-0.5 truncate text-[11px] text-neutral-400">
        W {slot.wins} · T {slot.ties} · L {slot.losses} · Diff{" "}
        {slot.diff > 0 ? `+${slot.diff}` : slot.diff}
      </p>
    </div>
  );
}
