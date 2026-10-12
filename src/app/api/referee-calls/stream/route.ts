import { auth } from "@/auth";
import { listOpenRefereeCalls } from "@/lib/referee-calls";

// Live feed of open referee calls for Admin/Staff screens (Server-Sent Events). The DB is
// reached through a connection pooler, so there's no LISTEN/NOTIFY to push from — instead
// each open stream checks once a second and only sends when something changed, which keeps
// a new call on the referee's screen within about a second of the tap at the table.
const POLL_MS = 1000;
const HEARTBEAT_MS = 15_000;
// End each stream well inside the function's max duration; EventSource reconnects on its own
// (after the `retry` delay below), which also re-checks the session.
const STREAM_LIFETIME_MS = 240_000;

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
