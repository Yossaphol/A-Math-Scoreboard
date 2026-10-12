"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import type { FlashType } from "@/lib/flash";
import { playAlertChime } from "./sound";

export type AlertType = FlashType;

export type AlertInput = {
  // Stable id lets a caller update or dismiss its own alert later (e.g. a referee call that
  // got acknowledged); re-showing an id that's already on screen just updates it.
  id?: string;
  type: AlertType;
  title: string;
  description?: string;
  // ms until it hides itself; null = stays until closed. Defaults: success/info 4s,
  // warning/error stay (they usually need someone to act on them).
  duration?: number | null;
  sound?: boolean;
  // Pulsing ring for alerts that are still waiting on someone (an unanswered referee call).
  attention?: boolean;
  actions?: ReactNode;
  // Called when the person closes it with ✕ (not when it times out or is dismissed in code).
  onClose?: () => void;
};

// shownAt changes on every (re)show, so a replaced alert's countdown starts over.
export type ActiveAlert = AlertInput & { id: string; duration: number | null; createdAt: number; shownAt: number };

// What the notification panel keeps — serializable, so it can live in localStorage.
export type NotificationEntry = {
  id: string;
  type: AlertType;
  title: string;
  description?: string;
  createdAt: number;
};

const DEFAULT_DURATION: Record<AlertType, number | null> = {
  success: 4000,
  info: 4000,
  warning: null,
  error: null,
};

const HISTORY_KEY = "notifications:v1";
const READ_KEY = "notifications:last-read";
const HISTORY_LIMIT = 50;

type State = { alerts: ActiveAlert[]; history: NotificationEntry[]; lastReadAt: number };

let state: State = { alerts: [], history: [], lastReadAt: 0 };
let hydrated = false;
const listeners = new Set<() => void>();
const SERVER_STATE: State = { alerts: [], history: [], lastReadAt: 0 };

function emit(next: State) {
  state = next;
  listeners.forEach((l) => l());
}

// localStorage can be missing or throw (private mode, blocked storage) — history is a
// convenience, so any failure just means it doesn't survive a reload.
function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const history = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]") as NotificationEntry[];
    const lastReadAt = Number(localStorage.getItem(READ_KEY) ?? 0) || 0;
    state = { ...state, history: Array.isArray(history) ? history : [], lastReadAt };
  } catch {}
}

function persist(next: State) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next.history));
    localStorage.setItem(READ_KEY, String(next.lastReadAt));
  } catch {}
}

function subscribe(listener: () => void) {
  hydrate();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useAlertState() {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => SERVER_STATE
  );
}

export function showAlert(input: AlertInput) {
  hydrate();
  const id = input.id ?? crypto.randomUUID();
  const duration = input.duration === undefined ? DEFAULT_DURATION[input.type] : input.duration;
  const existing = state.alerts.find((a) => a.id === id);
  const alert: ActiveAlert = { ...input, id, duration, createdAt: existing?.createdAt ?? Date.now(), shownAt: Date.now() };

  const entry: NotificationEntry = {
    id,
    type: input.type,
    title: input.title,
    description: input.description,
    createdAt: alert.createdAt,
  };
  const history = [entry, ...state.history.filter((h) => h.id !== id)].slice(0, HISTORY_LIMIT);
  const alerts = existing ? state.alerts.map((a) => (a.id === id ? alert : a)) : [...state.alerts, alert];

  const next = { ...state, alerts, history };
  persist(next);
  emit(next);
  if (input.sound && !existing?.sound) playAlertChime();
  return id;
}

export function dismissAlert(id: string) {
  if (!state.alerts.some((a) => a.id === id)) return;
  emit({ ...state, alerts: state.alerts.filter((a) => a.id !== id) });
}

export function dismissAlertsWhere(predicate: (id: string) => boolean) {
  if (!state.alerts.some((a) => predicate(a.id))) return;
  emit({ ...state, alerts: state.alerts.filter((a) => !predicate(a.id)) });
}

/** The ✕ button — tells the alert's owner it was closed by hand, then removes it. */
export function closeAlert(id: string) {
  state.alerts.find((a) => a.id === id)?.onClose?.();
  dismissAlert(id);
}

export function markNotificationsRead() {
  const next = { ...state, lastReadAt: Date.now() };
  persist(next);
  emit(next);
}

export function clearNotifications() {
  const next = { ...state, history: [], lastReadAt: Date.now() };
  persist(next);
  emit(next);
}
