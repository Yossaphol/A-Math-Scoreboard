import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/generated/prisma/enums";

/**
 * Memoized per-request session read. This is the ONLY place page/action code
 * should read auth from — never trust proxy.ts redirects as the real check
 * (spec §5: backend must enforce permissions, not just hide UI).
 */
export const getSession = cache(async () => {
  return auth();
});

export async function requireUser() {
  const session = await getSession();
  if (!session?.user) {
    redirect("/login");
  }
  return session.user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN") {
    redirect("/admin");
  }
  return user;
}

/**
 * Gate for everything under /admin/(protected): only ADMIN and STAFF belong there. A plain
 * USER (e.g. a Google sign-in that only ever created a User row, spec §4) must never see the
 * admin shell, so send them straight to the public home page instead of /login — looping
 * them back to login would just re-admit them into the same layout.
 */
export async function requireStaffOrAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN" && user.role !== "STAFF") {
    redirect("/");
  }
  return user;
}

/**
 * Enforces spec §6 scope rules for a request touching one Tournament:
 * - ADMIN: full access to every tournament.
 * - STAFF: only tournaments they have an ACTIVE TournamentStaff assignment for.
 * - anyone else: denied.
 *
 * Use this from Server Actions and data-loading functions (not just pages),
 * since it is the real enforcement point — every API/action must call it.
 */
export const canAccessTournament = cache(
  async (userId: string, role: Role, tournamentId: string): Promise<boolean> => {
    if (role === "ADMIN") return true;
    if (role !== "STAFF") return false;

    const assignment = await prisma.tournamentStaff.findUnique({
      where: { userId_tournamentId: { userId, tournamentId } },
    });
    return assignment?.status === "ACTIVE";
  }
);

/** Page-level guard: redirects if the current user can't access this tournament. */
export async function requireTournamentAccess(tournamentId: string) {
  const user = await requireUser();
  const allowed = await canAccessTournament(user.id, user.role, tournamentId);
  if (!allowed) {
    redirect("/admin");
  }
  return user;
}

/** Server Action guard: throws instead of redirecting, since actions can't navigate mid-mutation. */
export async function assertTournamentAccess(tournamentId: string) {
  const session = await getSession();
  if (!session?.user) throw new Error("Unauthorized");

  const allowed = await canAccessTournament(session.user.id, session.user.role, tournamentId);
  if (!allowed) throw new Error("Forbidden: no access to this tournament");

  return session.user;
}

/** Server Action guard for Admin-only mutations (create tournament, manage staff/admins, global players). */
export async function assertAdmin() {
  const session = await getSession();
  if (!session?.user) throw new Error("Unauthorized");
  if (session.user.role !== "ADMIN") throw new Error("Forbidden: admin only");
  return session.user;
}
