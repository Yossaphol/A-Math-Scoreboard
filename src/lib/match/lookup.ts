import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * Spec §12 flow: Scan Table QR -> Detect Tournament -> Detect Current Round -> Detect Table
 * -> Detect Players -> Open Match. "Current round" is the one Round that's CONFIRMED (locked
 * pairing, matches in progress) but not yet COMPLETED — startPairing (spec §9/§10) refuses to
 * generate a new round while one is still in progress, so at most one qualifies at a time.
 */
export async function getActiveMatchForTable(qrToken: string) {
  const table = await prisma.tournamentTable.findUnique({
    where: { qrToken },
    include: { tournament: true },
  });
  if (!table) return { error: "ไม่พบโต๊ะนี้" as const };

  const round = await prisma.round.findFirst({
    where: { tournamentId: table.tournamentId, status: "CONFIRMED" },
    orderBy: { roundNumber: "desc" },
  });
  if (!round) return { error: "ยังไม่มีรอบที่กำลังแข่งขันอยู่ในขณะนี้" as const };

  const match = await prisma.match.findFirst({
    where: { roundId: round.id, tableId: table.id },
    include: {
      player1: { include: { globalPlayer: true } },
      player2: { include: { globalPlayer: true } },
      submissions: true,
    },
  });
  if (!match) return { error: "โต๊ะนี้ไม่มี Match ในรอบปัจจุบัน" as const };

  return { table, tournament: table.tournament, round, match };
}
