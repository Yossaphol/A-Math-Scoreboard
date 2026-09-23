"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { assertAdmin, assertTournamentAccess } from "@/lib/dal";
import { setFlash } from "@/lib/flash";
import { practiceUnlockCookieName } from "@/lib/practice-lock";
import { publicTournamentPath, publicTournamentListPath } from "@/lib/tournament-path";
import { logAdminAction } from "@/lib/audit-log";

const createTournamentSchema = z.object({
  name: z.string().trim().min(2, "ชื่อ Tournament ต้องมีอย่างน้อย 2 ตัวอักษร"),
  mode: z.enum(["COMPETITION", "PRACTICE"]),
  maxPlayers: z.coerce.number().int().positive().optional(),
  numberOfGames: z.coerce.number().int().positive().optional(),
  defaultMaximumScore: z.coerce.number().int().positive().optional(),
});

function generatePinCode() {
  return String(Math.floor(1000 + Math.random() * 9000)); // 4 digits, 1000-9999
}

function generateSelfServiceToken() {
  return crypto.randomUUID().replace(/-/g, "");
}

// Spec §7: player-limit and game-count toggles are independent settings — never merged.
export async function createTournament(formData: FormData) {
  const admin = await assertAdmin();

  const setPlayerLimit = formData.get("setPlayerLimit") === "on";
  const setNumberOfGames = formData.get("setNumberOfGames") === "on";
  const useFirstSecond = formData.get("useFirstSecond") === "on";
  const setPin = formData.get("setPin") === "on";

  const parsed = createTournamentSchema.safeParse({
    name: formData.get("name"),
    mode: formData.get("mode"),
    maxPlayers: formData.get("maxPlayers") || undefined,
    numberOfGames: formData.get("numberOfGames") || undefined,
    defaultMaximumScore: formData.get("defaultMaximumScore") || undefined,
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((i) => i.message).join(", "));
  }
  const data = parsed.data;

  // The PIN is Practice-only — a Competition tournament ignores this field even if somehow
  // submitted, since anyone can already view Competition results publicly by design.
  const pinCode = data.mode === "PRACTICE" && setPin ? generatePinCode() : null;

  // Self-service ad-hoc scoring link — Practice-only, generated unconditionally (unlike the
  // PIN, there's no opt-out) since it's the only way to reach that flow at all.
  const selfServiceToken = data.mode === "PRACTICE" ? generateSelfServiceToken() : null;

  const tournament = await prisma.tournament.create({
    data: {
      name: data.name,
      mode: data.mode,
      status: "UPCOMING",
      setPlayerLimit,
      maxPlayers: setPlayerLimit ? data.maxPlayers ?? null : null,
      setNumberOfGames,
      numberOfGames: setNumberOfGames ? data.numberOfGames ?? null : null,
      useFirstSecond,
      // Only a default seed for new Games — never a Tournament-wide cap (spec §8).
      defaultMaximumScore: data.defaultMaximumScore ?? 350,
      pinCode,
      selfServiceToken,
      createdById: admin.id,
    },
  });

  await setFlash(
    pinCode
      ? `สร้าง Tournament "${tournament.name}" แล้ว — รหัสผ่าน: ${pinCode}`
      : `สร้าง Tournament "${tournament.name}" แล้ว`
  );
  revalidatePath("/admin/tournaments");
  redirect(`/admin/tournaments/${tournament.id}`);
}

const updateStatusSchema = z.object({
  tournamentId: z.string().min(1),
  status: z.enum(["UPCOMING", "ONGOING", "COMPLETED"]),
});

// Lets Admin/Staff move a Tournament through its lifecycle by hand (e.g. flip to ONGOING
// once the event actually starts) — nothing in the spec ties this to pairing state, so it's
// a plain manual control on the Settings page.
export async function updateTournamentStatus(formData: FormData) {
  const parsed = updateStatusSchema.safeParse({
    tournamentId: formData.get("tournamentId"),
    status: formData.get("status"),
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((i) => i.message).join(", "));
  }
  const { tournamentId, status } = parsed.data;
  await assertTournamentAccess(tournamentId);

  const tournament = await prisma.tournament.update({ where: { id: tournamentId }, data: { status } });

  await setFlash("อัปเดตสถานะ Tournament แล้ว");
  revalidatePath(`/admin/tournaments/${tournamentId}`);
  revalidatePath(`/admin/tournaments/${tournamentId}/settings`);
  revalidatePath("/admin/tournaments");
  revalidatePath(publicTournamentPath(tournament));
  revalidatePath(publicTournamentListPath(tournament.mode));
}

const deleteTournamentSchema = z.object({
  tournamentId: z.string().min(1),
});

// Admin-only, like create — deleting removes every Round/Match/Player/Table under it
// (all cascade from Tournament in the schema) with no way back, so it lives behind a
// confirmation dialog in the UI (see ConfirmSubmitButton on the Settings page).
export async function deleteTournament(formData: FormData) {
  const parsed = deleteTournamentSchema.safeParse({
    tournamentId: formData.get("tournamentId"),
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((i) => i.message).join(", "));
  }
  const { tournamentId } = parsed.data;
  const admin = await assertAdmin();

  const tournament = await prisma.tournament.findUniqueOrThrow({ where: { id: tournamentId } });
  await prisma.tournament.delete({ where: { id: tournamentId } });

  await logAdminAction({
    actorId: admin.id,
    action: "tournament.delete",
    summary: `ลบ Tournament "${tournament.name}" (${tournament.mode})`,
    targetType: "Tournament",
    targetId: tournament.id,
  });

  await setFlash(`ลบ Tournament "${tournament.name}" แล้ว`);
  revalidatePath("/admin/tournaments");
  revalidatePath(publicTournamentListPath(tournament.mode));
  redirect("/admin/tournaments");
}

const unlockPracticeSchema = z.object({
  tournamentId: z.string().min(1),
  pin: z.string().trim().min(1),
});

// Public, no login required (spec: practice PIN gate replaces auth for casual visitors, not
// a substitute for it) — see src/lib/practice-lock.ts for who's allowed to skip this.
export async function unlockPracticeTournament(formData: FormData) {
  const parsed = unlockPracticeSchema.safeParse({
    tournamentId: formData.get("tournamentId"),
    pin: formData.get("pin"),
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((i) => i.message).join(", "));
  }
  const { tournamentId, pin } = parsed.data;

  const tournament = await prisma.tournament.findUniqueOrThrow({ where: { id: tournamentId } });

  if (!tournament.pinCode || pin !== tournament.pinCode) {
    await setFlash("รหัสผ่านไม่ถูกต้อง", "error");
    redirect(`/practice/${tournamentId}`);
  }

  const store = await cookies();
  store.set(practiceUnlockCookieName(tournamentId), "1", {
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
    httpOnly: true,
    sameSite: "lax",
  });

  revalidatePath(`/practice/${tournamentId}`);
  redirect(`/practice/${tournamentId}`);
}

// Lazily backfills a selfServiceToken for a Practice tournament created before this feature
// existed — new tournaments already get one unconditionally in createTournament. Race-safe:
// a conditional update (only where the token is still null) means two concurrent callers
// can't clobber a token that's already been printed/shared.
export async function ensureSelfServiceToken(tournamentId: string): Promise<string> {
  const tournament = await prisma.tournament.findUniqueOrThrow({ where: { id: tournamentId } });
  if (tournament.selfServiceToken) return tournament.selfServiceToken;

  const token = generateSelfServiceToken();
  const updated = await prisma.tournament.updateMany({
    where: { id: tournamentId, selfServiceToken: null },
    data: { selfServiceToken: token },
  });
  if (updated.count === 0) {
    const fresh = await prisma.tournament.findUniqueOrThrow({ where: { id: tournamentId } });
    return fresh.selfServiceToken!;
  }
  return token;
}
