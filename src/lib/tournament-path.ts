import type { TournamentMode } from "@/generated/prisma/enums";

/** The public site is split by mode: Competition lives under /t/[id], Practice under
 * /practice/[id]. Every place that builds a public tournament link/redirect goes through
 * this so the two trees can never drift apart on which prefix belongs to which mode. */
export function publicTournamentPath({ id, mode }: { id: string; mode: TournamentMode }): string {
  return mode === "PRACTICE" ? `/practice/${id}` : `/t/${id}`;
}

export function publicTournamentListPath(mode: TournamentMode): string {
  return mode === "PRACTICE" ? "/practice" : "/";
}
