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

/** A table result the players settled (or disagreed on) by themselves — see listMatchEvents. */
export type MatchEventView = {
  key: string;
  matchId: string;
  status: "CONFIRMED" | "CONFLICT";
  updatedAt: string;
  tournamentName: string;
  roundNumber: number | null;
  tableNumber: number | null;
  player1: string;
  player2: string;
  player1Score: number | null;
  player2Score: number | null;
  tie: boolean;
};

/**
 * Results players confirmed — or submitted mismatched — at a table since `since`, so Admin/Staff
 * screens hear about them too (the player-side alert only ever reaches the phone that sent it).
 * Round matches only: practice self-service games are logged far too often to pop up one by
 * one. Admin-entered results are skipped — whoever saved one already got their own alert.
 */
export async function listMatchEvents(
  user: { id: string; role: Role },
  since: Date
): Promise<MatchEventView[]> {
  const matches = await prisma.match.findMany({
    where: {
      updatedAt: { gt: since },
      roundId: { not: null },
      isBye: false,
      editedByAdminId: null,
      status: { in: ["CONFIRMED", "CONFLICT"] },
      ...(user.role === "ADMIN"
        ? {}
        : { tournament: { staff: { some: { userId: user.id, status: "ACTIVE" } } } }),
    },
    orderBy: { updatedAt: "asc" },
    take: 50,
    select: {
      id: true,
      status: true,
      updatedAt: true,
      finalPlayer1Score: true,
      finalPlayer2Score: true,
      player1Result: true,
      tournament: { select: { name: true } },
      round: { select: { roundNumber: true } },
      table: { select: { tableNumber: true } },
      player1: { select: { globalPlayer: { select: { name: true } } } },
      player2: { select: { globalPlayer: { select: { name: true } } } },
    },
  });

  return matches.map((m) => ({
    key: `${m.id}:${m.status}:${m.updatedAt.getTime()}`,
    matchId: m.id,
    status: m.status as MatchEventView["status"],
    updatedAt: m.updatedAt.toISOString(),
    tournamentName: m.tournament.name,
    roundNumber: m.round?.roundNumber ?? null,
    tableNumber: m.table?.tableNumber ?? null,
    player1: m.player1.globalPlayer.name,
    player2: m.player2?.globalPlayer.name ?? "",
    player1Score: m.finalPlayer1Score,
    player2Score: m.finalPlayer2Score,
    tie: m.status === "CONFIRMED" && m.player1Result === "TIE",
  }));
}
