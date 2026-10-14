"use client";

import { useSyncExternalStore } from "react";

// Per-device switches on the Settings page ("เครื่องนี้") — a referee on the floor wants the
// ring and every result popping up, a laptop at the front desk might not. Kept in
// localStorage, which can be missing or throw; then a switch just doesn't survive a reload.
function devicePref(key: string) {
  const listeners = new Set<() => void>();
  let value: boolean | null = null;

  const get = () => {
    if (value === null) {
      try {
        value = localStorage.getItem(key) === "1";
      } catch {
        value = false;
      }
    }
    return value;
  };
  const set = (next: boolean) => {
    value = next;
    try {
      localStorage.setItem(key, next ? "1" : "0");
    } catch {}
    listeners.forEach((l) => l());
  };
  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };
  const use = () => useSyncExternalStore(subscribe, get, () => false);
  return { get, set, subscribe, use };
}

// Referee calls ring until taken — muted, the popup still shows, only the chime is skipped.
const refereeSound = devicePref("referee-calls:muted");
export const isRefereeSoundMuted = refereeSound.get;
export const setRefereeSoundMuted = refereeSound.set;
export const subscribeRefereeSoundMuted = refereeSound.subscribe;
export const useRefereeSoundMuted = refereeSound.use;

// Match results popping up top-right: settled at the tables (ยืนยันผล / ผลไม่ตรงกัน / ผลเสมอ)
// and saved by Admin/Staff themselves (บันทึกผลแล้ว). Hidden, they still land in the bell's
// history. Referee calls and errors always pop up — someone has to act on them.
const resultPopups = devicePref("result-popups:hidden");
export const areResultPopupsHidden = resultPopups.get;
export const setResultPopupsHidden = resultPopups.set;
export const useResultPopupsHidden = resultPopups.use;
