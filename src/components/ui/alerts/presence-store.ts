"use client";

import { useSyncExternalStore } from "react";
import type { OnlineStaff } from "@/lib/presence";

// Who's online, as last reported by the admin live stream (RefereeCallAlerts owns the stream
// and writes here; OnlineStaffButton reads). null until the first report arrives.
let online: OnlineStaff[] | null = null;
const listeners = new Set<() => void>();

export function setOnlineStaff(next: OnlineStaff[]) {
  online = next;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useOnlineStaff() {
  return useSyncExternalStore(
    subscribe,
    () => online,
    () => null
  );
}

// "This screen" for presence — a random id kept per browser so reloads and reconnects count as
// the same screen. Falls back to a per-page id when storage is unavailable.
let deviceId: string | null = null;
export function getDeviceId() {
  if (deviceId) return deviceId;
  try {
    deviceId = localStorage.getItem("presence:device");
    if (!deviceId) {
      deviceId = crypto.randomUUID();
      localStorage.setItem("presence:device", deviceId);
    }
  } catch {
    deviceId = crypto.randomUUID();
  }
  return deviceId;
}
