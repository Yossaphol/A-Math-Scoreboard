"use client";

import { useEffect, useRef, useSyncExternalStore, useTransition } from "react";
import Link from "next/link";
import type { MatchEventView, RefereeCallView } from "@/lib/referee-calls";
import { acknowledgeRefereeCall, resolveRefereeCall } from "@/lib/actions/referee-calls";
import { Button } from "@/components/ui/Button";
import { dismissAlertsWhere, showAlert } from "./store";
import { isAudioUnlocked, playAlertChime, subscribeAudioState, unlockAudio } from "./sound";
import { isRefereeSoundMuted, subscribeRefereeSoundMuted, useRefereeSoundMuted } from "./referee-sound-pref";
import { getDeviceId, setOnlineStaff } from "./presence-store";
import type { OnlineStaff } from "@/lib/presence";

// Keeps ringing (one ~1s chime, then a short gap) for as long as any call on this screen is
// still OPEN — it stops once a referee taps "รับเรื่อง" or closes the card with ✕.
const RING_EVERY_MS = 2_000;

// The server pings every 15s even when nothing changes — this much silence means a dead stream.
const STALE_STREAM_MS = 35_000;

const ALERT_PREFIX = "referee-";
const alertId = (callId: string) => `${ALERT_PREFIX}${callId}`;
const timeFormat = new Intl.DateTimeFormat("th-TH", { hour: "2-digit", minute: "2-digit" });

/**
 * Admin/Staff live feed. Referee side of the table's "เรียกกรรมการ" button: pops each open
 * call up top-right with a chime until someone takes it. Also relays results the players
 * confirm (or disagree on) at their tables. Mounted for Admin/Staff only (admin shell +
 * public site when signed in as Staff/Admin).
 */
export function RefereeCallAlerts() {
  // Calls this screen's referee closed with ✕ — they stay closed even as the stream keeps
  // reporting them (another referee may be handling it), until the page is reloaded.
  const closedByHand = useRef(new Set<string>());
  const openCalls = useRef<RefereeCallView[]>([]);

  useEffect(() => {
    let source: EventSource | null = null;
    let lastMessageAt = 0;
    let retryDelay = 1000;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    // Last match-event id seen, so a stream this page reopens itself picks up where it left off.
    let matchCursor: string | null = null;
    const seenMatchEvents = new Set<string>();

    const onCalls = (event: MessageEvent<string>) => {
      lastMessageAt = Date.now();
      retryDelay = 1000;
      const calls = JSON.parse(event.data) as RefereeCallView[];
      openCalls.current = calls;
      const live = new Set(calls.map((c) => alertId(c.id)));

      for (const call of calls) {
        if (closedByHand.current.has(call.id)) continue;
        showAlert({
          id: alertId(call.id),
          type: "warning",
          title: `เรียกกรรมการ · โต๊ะ ${call.tableNumber}`,
          description: describe(call),
          duration: null,
          sound: call.status === "OPEN" && !isRefereeSoundMuted(),
          attention: call.status === "OPEN",
          actions: <CallActions call={call} />,
          onClose: () => closedByHand.current.add(call.id),
        });
      }
      // Resolved or cancelled (here or on another referee's screen) — take it down.
      dismissAlertsWhere((id) => id.startsWith(ALERT_PREFIX) && !live.has(id));
    };

    // Results players settled at their tables. The player-side alert only reaches the phone that
    // sent it, so this is how Admin/Staff hear about them — same wording, plus where it was.
    const onMatches = (event: MessageEvent<string>) => {
      lastMessageAt = Date.now();
      if (event.lastEventId) matchCursor = event.lastEventId;
      for (const m of JSON.parse(event.data) as MatchEventView[]) {
        if (seenMatchEvents.has(m.key)) continue;
        seenMatchEvents.add(m.key);
        const where = [
          m.roundNumber != null ? `Round ${m.roundNumber}` : null,
          m.tableNumber != null ? `Table ${m.tableNumber}` : null,
        ]
          .filter(Boolean)
          .join(" · ");
        // Keyed per match, so "ผลไม่ตรงกัน" turns into "ยืนยันผลแล้ว" once the players fix it.
        const id = `admin-match-${m.matchId}`;
        if (m.status === "CONFLICT") {
          showAlert({ id, type: "warning", title: "ผลไม่ตรงกัน", description: `${where} · ${m.player1} vs ${m.player2}` });
        } else {
          showAlert({
            id,
            type: m.tie ? "warning" : "success",
            title: m.tie ? "ผลเสมอ — ให้กรรมการตรวจ" : "ยืนยันผลแล้ว",
            description: `${where} · ${m.player1} ${m.player1Score} – ${m.player2Score} ${m.player2}`,
          });
        }
      }
    };

    // EventSource reconnects by itself after a dropped connection, but gives up for good on
    // an error response (a deploy, a blip on the server), and a half-open connection can go
    // quiet without erroring at all. The server pings at least every 15s, so silence well
    // past that — or a closed source — means: open a fresh one.
    const connect = () => {
      source?.close();
      lastMessageAt = Date.now();
      // device + muted feed this screen's "who's online" row (lib/presence.ts).
      const query = new URLSearchParams({ device: getDeviceId(), muted: isRefereeSoundMuted() ? "1" : "0" });
      if (matchCursor) query.set("since", matchCursor);
      source = new EventSource(`/api/referee-calls/stream?${query}`);
      source.addEventListener("presence", (event) => {
        lastMessageAt = Date.now();
        setOnlineStaff(JSON.parse((event as MessageEvent<string>).data) as OnlineStaff[]);
      });
      source.addEventListener("calls", onCalls as EventListener);
      source.addEventListener("matches", onMatches as EventListener);
      source.addEventListener("ping", () => (lastMessageAt = Date.now()));
      source.onopen = () => (lastMessageAt = Date.now());
      source.onerror = () => {
        if (source?.readyState !== EventSource.CLOSED || retryTimer) return;
        retryTimer = setTimeout(() => {
          retryTimer = null;
          connect();
        }, retryDelay);
        retryDelay = Math.min(retryDelay * 2, 15_000);
      };
    };
    const ensureAlive = () => {
      const stale = Date.now() - lastMessageAt > STALE_STREAM_MS;
      if (!retryTimer && (source?.readyState === EventSource.CLOSED || stale)) connect();
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") ensureAlive();
    };

    connect();
    // Reopen with the new setting so others see this screen's sound on/off right away.
    const unsubscribeMuted = subscribeRefereeSoundMuted(connect);
    const watchdog = setInterval(ensureAlive, 5000);
    document.addEventListener("visibilitychange", onVisibility);

    const ringer = setInterval(() => {
      const unanswered = openCalls.current.some((c) => c.status === "OPEN" && !closedByHand.current.has(c.id));
      if (unanswered && !isRefereeSoundMuted()) playAlertChime();
    }, RING_EVERY_MS);

    return () => {
      source?.close();
      unsubscribeMuted();
      if (retryTimer) clearTimeout(retryTimer);
      clearInterval(watchdog);
      clearInterval(ringer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return <SoundUnlockHint />;
}

function describe(call: RefereeCallView) {
  const where = [call.players, call.roundNumber != null ? `รอบที่ ${call.roundNumber}` : null, call.tournamentName]
    .filter(Boolean)
    .join(" · ");
  const when = `เรียกเมื่อ ${timeFormat.format(new Date(call.createdAt))}`;
  return call.status === "ACKNOWLEDGED"
    ? `${where}\n${call.handledByName ?? "กรรมการ"} รับเรื่องแล้ว · ${when}`
    : `${where}\n${when}`;
}

function CallActions({ call }: { call: RefereeCallView }) {
  const [pending, startTransition] = useTransition();
  return (
    <>
      {call.status === "OPEN" && (
        <Button size="sm" disabled={pending} onClick={() => startTransition(() => acknowledgeRefereeCall(call.id))}>
          รับเรื่อง
        </Button>
      )}
      <Button
        size="sm"
        variant="secondary"
        disabled={pending}
        onClick={() => startTransition(() => resolveRefereeCall(call.id))}
      >
        เสร็จแล้ว
      </Button>
      {call.roundId && call.matchId && (
        <Link
          href={
            call.roundLive
              ? `/admin/score-entry?t=${call.tournamentId}&m=${call.matchId}`
              : `/admin/tournaments/${call.tournamentId}/rounds/${call.roundId}`
          }
          className="px-1 text-xs font-medium text-neutral-500 hover:text-neutral-900"
        >
          ดู Match →
        </Link>
      )}
    </>
  );
}

// Browsers stay silent until the page has been tapped once — a referee who just opened the
// admin screen and put the phone down would otherwise miss the chime entirely.
function SoundUnlockHint() {
  const unlocked = useSyncExternalStore(subscribeAudioState, isAudioUnlocked, () => true);
  const muted = useRefereeSoundMuted();
  if (unlocked || muted) return null;
  return (
    <button
      type="button"
      onClick={() => {
        unlockAudio();
        playAlertChime();
      }}
      className="fixed bottom-4 right-4 z-[55] flex items-center gap-2 rounded-full bg-neutral-900 px-3 py-2 text-xs sm:px-4 sm:py-2.5 font-medium text-white shadow-lg transition-colors hover:bg-neutral-700"
    >
      <svg viewBox="0 0 24 24" fill="none" className="size-4" aria-hidden="true">
        <path
          d="M11 5L6 9H3v6h3l5 4V5zM15.5 8.5a5 5 0 010 7M18.5 5.5a9 9 0 010 13"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="sm:hidden">เปิดเสียง</span>
      <span className="hidden sm:inline">แตะเพื่อเปิดเสียงเรียกกรรมการ</span>
    </button>
  );
}
