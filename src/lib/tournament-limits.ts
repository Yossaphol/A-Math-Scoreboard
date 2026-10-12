import "server-only";
import type { Prisma } from "@/generated/prisma/client";

// Spec §7: the two "set in advance" toggles on a Tournament. Both are independent, and each
// is only a real limit while its toggle is on AND a number was given.

type PlayerLimitFields = { setPlayerLimit: boolean; maxPlayers: number | null };
type RoundLimitFields = { setNumberOfGames: boolean; numberOfGames: number | null };

export function playerLimitOf(t: PlayerLimitFields): number | null {
  return t.setPlayerLimit && t.maxPlayers != null ? t.maxPlayers : null;
}

export function roundLimitOf(t: RoundLimitFields): number | null {
  return t.setNumberOfGames && t.numberOfGames != null ? t.numberOfGames : null;
}

/**
 * Locks the Tournament row and returns how many more ACTIVE players it can take (Infinity
 * when there's no limit). The limit counts ACTIVE players only: a Withdrawn player frees
 * their seat, and reactivating them needs one back. The FOR UPDATE lock serializes concurrent
 * adds/imports/reactivations for the same Tournament, so two of them can't both see the last
 * free seat — call it first thing inside the transaction that adds the player.
 */
export async function lockPlayerSlots(
  tx: Prisma.TransactionClient,
  tournamentId: string
): Promise<{ limit: number | null; remaining: number }> {
  await tx.$queryRaw`SELECT id FROM "Tournament" WHERE id = ${tournamentId} FOR UPDATE`;
  const tournament = await tx.tournament.findUniqueOrThrow({
    where: { id: tournamentId },
    select: { setPlayerLimit: true, maxPlayers: true },
  });
  const limit = playerLimitOf(tournament);
  if (limit == null) return { limit, remaining: Infinity };

  const active = await tx.tournamentPlayer.count({ where: { tournamentId, status: "ACTIVE" } });
  return { limit, remaining: Math.max(0, limit - active) };
}

export function playerLimitReachedMessage(limit: number | null) {
  return `ผู้เล่นครบ ${limit} คนตามที่กำหนดไว้แล้ว เพิ่มไม่ได้`;
}
