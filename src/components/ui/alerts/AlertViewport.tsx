"use client";

import { useEffect } from "react";
import { AlertIconTile, ALERT_TONE } from "./AlertIcon";
import { closeAlert, dismissAlert, useAlertState, type ActiveAlert } from "./store";
import { unlockAudioOnInteraction } from "./sound";

/**
 * Top-right stack every alert renders into (mounted once in the root layout). Timed alerts
 * show a shrinking bar along the bottom of the card; hovering pauses it, and the alert
 * closes when the bar runs out — the bar's own animationend is the timer, so the two can't
 * drift apart.
 */
export function AlertViewport() {
  const { alerts } = useAlertState();

  // Any page can raise a sound alert (a tie at the table, a referee call on an admin
  // screen), and browsers only allow sound after an interaction — arm it on the first one.
  useEffect(() => unlockAudioOnInteraction(), []);

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-4 top-4 z-[60] flex flex-col items-stretch gap-3 sm:left-auto sm:right-4 sm:w-[380px]"
    >
      {alerts.map((alert) => (
        <AlertCard key={alert.id} alert={alert} />
      ))}
    </div>
  );
}

function AlertCard({ alert }: { alert: ActiveAlert }) {
  const tone = ALERT_TONE[alert.type];
  return (
    <div
      role={alert.type === "error" || alert.type === "warning" ? "alert" : "status"}
      className={`group pointer-events-auto relative overflow-hidden rounded-2xl bg-white shadow-[0_10px_30px_-12px_rgba(16,24,40,0.25),0_2px_6px_rgba(16,24,40,0.06)] ring-1 ring-black/[0.04] ${
        alert.attention ? `ring-2 ${tone.ring} animate-[alert-attention_1.6s_ease-in-out_infinite]` : ""
      }`}
      style={{
        animation: alert.attention ? undefined : "alert-in 0.22s ease-out",
        backgroundImage: `radial-gradient(circle at 0% 0%, ${tone.glow}, transparent 55%)`,
      }}
    >
      <div className="flex items-start gap-3.5 p-4 pr-11">
        <AlertIconTile type={alert.type} />
        <div className="min-w-0 flex-1 pt-0.5">
          <p className="text-[15px] font-semibold leading-snug text-neutral-900">{alert.title}</p>
          {alert.description && (
            <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-neutral-500">{alert.description}</p>
          )}
          {alert.actions && <div className="mt-3 flex flex-wrap items-center gap-2">{alert.actions}</div>}
        </div>
      </div>
      <button
        type="button"
        onClick={() => closeAlert(alert.id)}
        aria-label="ปิด"
        className="absolute right-2.5 top-2.5 flex size-8 items-center justify-center rounded-lg text-neutral-400 transition-colors hover:bg-black/5 hover:text-neutral-700"
      >
        <svg viewBox="0 0 24 24" fill="none" className="size-4" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
      {alert.duration != null && (
        <div className="absolute inset-x-0 bottom-0 h-1 bg-black/[0.04]">
          <div
            key={alert.shownAt}
            className={`h-full origin-left ${tone.bar} opacity-70 group-hover:[animation-play-state:paused]`}
            style={{ animation: `alert-countdown ${alert.duration}ms linear forwards` }}
            onAnimationEnd={() => dismissAlert(alert.id)}
          />
        </div>
      )}
    </div>
  );
}
