import { auth } from "@/auth";
import { listMatchEvents, listOpenRefereeCalls } from "@/lib/referee-calls";
import { forgetStalePresence, listOnlineStaff, PRESENCE_TOUCH_MS, touchPresence } from "@/lib/presence";
import { readSystemSettings } from "@/lib/system-settings";

// Live feed for Admin/Staff screens (Server-Sent Events): open referee calls, plus results
// players confirm or disagree on at their tables. The DB is
// reached through a connection pooler, so there's no LISTEN/NOTIFY to push from — instead
// each open stream checks once a second and only sends when something changed, which keeps
// a new call on the referee's screen within about a second of the tap at the table.
const POLL_MS = 1000;
const HEARTBEAT_MS = 15_000;
// End each stream well inside the function's max duration; EventSource reconnects on its own
// (after the `retry` delay below), which also re-checks the session.
const STREAM_LIFETIME_MS = 240_000;
// Match results: re-read a few seconds back each time, so a result whose transaction committed
// just after a poll (with an earlier updatedAt) isn't skipped — duplicates are filtered out.
const MATCH_OVERLAP_MS = 5_000;
// How far back a reconnecting screen may ask to catch up.
const MAX_CATCH_UP_MS = 5 * 60_000;

// The "who's online" list changes slowly — no need to re-read it every tick.
const PRESENCE_LIST_MS = 5_000;

// How often an open stream re-checks the /admin/settings switch, so screens left open stop
// soon after an Admin turns the live feed off.
const SETTINGS_CHECK_MS = 30_000;

// Tells the page to stop for good (no reconnect) — sent when the live feed is switched off.
const DISABLED_EVENT = "event: disabled\ndata: \n\n";

// Where to resume the match feed: the last event id this screen saw (sent by EventSource as
// Last-Event-ID on its own reconnects, or as ?since= when the page reopens the stream itself).
function resumePoint(request: Request) {
  const raw = request.headers.get("last-event-id") ?? new URL(request.url).searchParams.get("since");
  const at = raw ? new Date(raw) : null;
  const floor = Date.now() - MAX_CATCH_UP_MS;
  return at && !Number.isNaN(at.getTime()) ? new Date(Math.max(at.getTime(), floor)) : new Date();
}

export async function GET(request: Request) {
  const session = await auth();
  const user = session?.user;
  if (!user || (user.role !== "ADMIN" && user.role !== "STAFF")) {
    return new Response("Unauthorized", { status: 401 });
  }

  // This screen's presence row (see lib/presence.ts): a random id the page keeps, plus whether
  // it has the referee chime muted. A stream without an id just isn't counted as online.
  const params = new URL(request.url).searchParams;
  const rawDevice = params.get("device") ?? "";
  const deviceId = /^[A-Za-z0-9-]{8,64}$/.test(rawDevice) ? rawDevice : null;
  const soundMuted = params.get("muted") === "1";

  const encoder = new TextEncoder();
  // Set when the client goes away, so a closed tab doesn't keep querying until the next write.
  let cancelled = false;
  const stream = new ReadableStream({
    async start(controller) {
      const startedAt = Date.now();
      let lastPayload = "";
      let lastSentAt = 0;
      let matchCursor = resumePoint(request);
      const sentMatchEvents = new Set<string>();
      const send = (chunk: string) => {
        controller.enqueue(encoder.encode(chunk));
        lastSentAt = Date.now();
      };

      send("retry: 1000\n\n");
      // 0: the first pass checks the switch before streaming anything.
      let lastSettingsCheck = 0;
      let lastTouch = 0;
      let lastPresenceRead = 0;
      let lastPresence = "";
      try {
        if (deviceId) await forgetStalePresence();
        while (!cancelled && !request.signal.aborted && Date.now() - startedAt < STREAM_LIFETIME_MS) {
          if (Date.now() - lastSettingsCheck >= SETTINGS_CHECK_MS) {
            lastSettingsCheck = Date.now();
            if (!(await readSystemSettings()).liveFeedEnabled) {
              send(DISABLED_EVENT);
              break;
            }
          }
          const payload = JSON.stringify(await listOpenRefereeCalls(user));
          if (payload !== lastPayload) {
            send(`event: calls\ndata: ${payload}\n\n`);
            lastPayload = payload;
          } else if (Date.now() - lastSentAt > HEARTBEAT_MS) {
            send("event: ping\ndata: \n\n");
          }

          if (deviceId && Date.now() - lastTouch >= PRESENCE_TOUCH_MS) {
            await touchPresence(user.id, deviceId, soundMuted);
            lastTouch = Date.now();
          }
          if (Date.now() - lastPresenceRead >= PRESENCE_LIST_MS) {
            const presence = JSON.stringify(await listOnlineStaff(user));
            lastPresenceRead = Date.now();
            if (presence !== lastPresence) {
              send(`event: presence\ndata: ${presence}\n\n`);
              lastPresence = presence;
            }
          }

          const since = new Date(matchCursor.getTime() - MATCH_OVERLAP_MS);
          const events = (await listMatchEvents(user, since)).filter((e) => !sentMatchEvents.has(e.key));
          if (events.length > 0) {
            events.forEach((e) => sentMatchEvents.add(e.key));
            const latest = new Date(events[events.length - 1].updatedAt);
            if (latest > matchCursor) matchCursor = latest;
            send(`id: ${matchCursor.toISOString()}\nevent: matches\ndata: ${JSON.stringify(events)}\n\n`);
          }
          await new Promise((resolve) => setTimeout(resolve, POLL_MS));
        }
      } catch {
        // Client went away mid-write, or a query failed — either way, let EventSource reconnect.
      }
      try {
        controller.close();
      } catch {}
    },
    cancel() {
      cancelled = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
