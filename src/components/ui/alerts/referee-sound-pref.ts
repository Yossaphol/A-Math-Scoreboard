"use client";

import { useSyncExternalStore } from "react";

// Per-device "mute referee calls" switch (in the admin notification panel) — a referee on
// the floor wants the ring, a laptop at the front desk might not. Popups still show either
// way; only the chime is skipped. localStorage can be missing or throw, in which case the
// switch just doesn't survive a reload.
const KEY = "referee-calls:muted";
const listeners = new Set<() => void>();
let muted: boolean | null = null;

export function isRefereeSoundMuted() {
  if (muted === null) {
    try {
      muted = localStorage.getItem(KEY) === "1";
    } catch {
      muted = false;
    }
  }
  return muted;
}

export function setRefereeSoundMuted(next: boolean) {
  muted = next;
  try {
    localStorage.setItem(KEY, next ? "1" : "0");
  } catch {}
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useRefereeSoundMuted() {
  return useSyncExternalStore(subscribe, isRefereeSoundMuted, () => false);
}
