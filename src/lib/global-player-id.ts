// No "server-only" guard here: prisma/seed.ts (a plain Node script, outside the Next.js
// bundler that aliases that package) also needs to call this.
import type { Prisma } from "@/generated/prisma/client";

const MIN_ID = 100_000;
const MAX_ID = 999_999;
const MAX_ATTEMPTS = 20;

/**
 * Global Player ID is a random 6-digit number (spec: human-facing, not a giveaway sequence
 * count) — assigned here rather than left to autoincrement, with a collision check since two
 * random draws can land on the same existing ID.
 */
export async function generateGlobalPlayerId(
  tx: Pick<Prisma.TransactionClient, "globalPlayer">
): Promise<number> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const candidate = Math.floor(Math.random() * (MAX_ID - MIN_ID + 1)) + MIN_ID;
    const existing = await tx.globalPlayer.findUnique({ where: { id: candidate } });
    if (!existing) return candidate;
  }
  throw new Error("ไม่สามารถสุ่ม Global Player ID ที่ว่างได้ กรุณาลองใหม่อีกครั้ง");
}
