import "server-only";
import { prisma } from "@/lib/prisma";
import type { RefereeCallStatus, Role } from "@/generated/prisma/enums";

export const OPEN_REFEREE_CALL_STATUSES: RefereeCallStatus[] = ["OPEN", "ACKNOWLEDGED"];

// A call nobody closed (the hall emptied, the referee forgot to tap "done") shouldn't ring
// on every screen forever.
const STALE_AFTER_MS = 6 * 60 * 60 * 1000;

/** What a referee's screen gets for each open call — see the stream route and RefereeCallAlerts. */
export type RefereeCallView = {
  id: string;
  status: "OPEN" | "ACKNOWLEDGED";
  createdAt: string;
  tournamentId: string;
  tournamentName: string;
  tableNumber: number;
  roundId: string | null;
  roundNumber: number | null;
  players: string | null;
  handledByName: string | null;
};

/** Open calls in every tournament this Admin (all) or Staff (ACTIVE assignments) can access. */
export async function listOpenRefereeCalls(user: { id: string; role: Role }): Promise<RefereeCallView[]> {
  const calls = await prisma.refereeCall.findMany({
    where: {
      status: { in: OPEN_REFEREE_CALL_STATUSES },
      createdAt: { gt: new Date(Date.now() - STALE_AFTER_MS) },
      ...(user.role === "ADMIN"
        ? {}
        : { tournament: { staff: { some: { userId: user.id, status: "ACTIVE" } } } }),
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      status: true,
      createdAt: true,
      tournament: { select: { id: true, name: true } },
      table: { select: { tableNumber: true } },
      handledBy: { select: { name: true, email: true } },
      match: {
        select: {
          round: { select: { id: true, roundNumber: true } },
          player1: { select: { globalPlayer: { select: { name: true } } } },
          player2: { select: { globalPlayer: { select: { name: true } } } },
        },
      },
    },
  });

  return calls.map((c) => ({
    id: c.id,
    status: c.status as RefereeCallView["status"],
    createdAt: c.createdAt.toISOString(),
    tournamentId: c.tournament.id,
    tournamentName: c.tournament.name,
    tableNumber: c.table.tableNumber,
    roundId: c.match?.round?.id ?? null,
    roundNumber: c.match?.round?.roundNumber ?? null,
    players: c.match
      ? [c.match.player1.globalPlayer.name, c.match.player2?.globalPlayer.name].filter(Boolean).join(" vs ")
      : null,
    handledByName: c.handledBy ? c.handledBy.name || c.handledBy.email : null,
  }));
}
