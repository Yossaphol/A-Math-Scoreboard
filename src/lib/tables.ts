import "server-only";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Keeps Table count at ceil(playerCount / 2) — the max number of matches that can run at
 * once. Only ever grows the table list (new tables get the next sequential number); it
 * never removes tables, since a Match may already reference one and physical tables at a
 * venue don't disappear just because a player later withdraws.
 */
export async function ensureTableCount(tx: Prisma.TransactionClient, tournamentId: string) {
  const totalPlayers = await tx.tournamentPlayer.count({ where: { tournamentId } });
  const target = Math.ceil(totalPlayers / 2);
  if (target === 0) return;

  const existingCount = await tx.tournamentTable.count({ where: { tournamentId } });
  if (existingCount >= target) return;

  await tx.tournamentTable.createMany({
    data: Array.from({ length: target - existingCount }, (_, i) => ({
      tournamentId,
      tableNumber: existingCount + i + 1,
    })),
  });
}
