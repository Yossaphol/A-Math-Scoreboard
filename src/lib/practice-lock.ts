import "server-only";
import { cookies } from "next/headers";
import { getSession, canAccessTournament } from "@/lib/dal";
import type { TournamentMode } from "@/generated/prisma/enums";

export function practiceUnlockCookieName(tournamentId: string) {
  return `tp_unlock_${tournamentId}`;
}

/**
 * Practice-mode-only soft privacy gate for the public /t/[id] pages: a random PIN (set at
 * creation, see createTournament) keeps casual visitors from browsing someone else's
 * practice history. Admin always bypasses it; Staff bypasses it only for tournaments they're
 * actually assigned to — everyone else needs the "unlocked" cookie set by entering the PIN.
 */
export async function hasPracticeAccess(tournament: {
  id: string;
  mode: TournamentMode;
  pinCode: string | null;
}): Promise<boolean> {
  if (tournament.mode !== "PRACTICE" || !tournament.pinCode) return true;

  const session = await getSession();
  if (session?.user) {
    if (session.user.role === "ADMIN") return true;
    if (session.user.role === "STAFF") {
      const allowed = await canAccessTournament(session.user.id, session.user.role, tournament.id);
      if (allowed) return true;
    }
  }

  const store = await cookies();
  return store.get(practiceUnlockCookieName(tournament.id))?.value === "1";
}
