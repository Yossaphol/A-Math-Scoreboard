import { auth } from "@/auth";
import { listMatchEvents, listOpenRefereeCalls } from "@/lib/referee-calls";

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
      try {
        while (!cancelled && !request.signal.aborted && Date.now() - startedAt < STREAM_LIFETIME_MS) {
          const payload = JSON.stringify(await listOpenRefereeCalls(user));
          if (payload !== lastPayload) {
            send(`event: calls\ndata: ${payload}\n\n`);
            lastPayload = payload;
          } else if (Date.now() - lastSentAt > HEARTBEAT_MS) {
            send("event: ping\ndata: \n\n");
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
