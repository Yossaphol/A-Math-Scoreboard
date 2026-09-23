// Pure planning step of repairRoundForAbsences (src/lib/actions/pairing.ts), kept free of the
// database so the rules can be checked on their own:
// - a match that has started (any score reported, or a result) is never touched, and none of
//   its players may be marked absent;
// - a match with both players present is kept as is;
// - a match with an absent player, and every Bye, is dissolved;
// - everyone present without a seat afterwards (including anyone just un-marked absent) goes
//   back into the pool to be re-paired among themselves.

export type RepairMatch = {
  id: string;
  player1Id: string;
  player2Id: string | null;
  isBye: boolean;
  status: string;
  submissionCount: number;
};

export function matchStarted(m: { status: string; submissionCount: number }) {
  return m.submissionCount > 0 || ["SUBMITTED", "CONFLICT", "CONFIRMED"].includes(m.status);
}

export function planAbsenceRepair<M extends RepairMatch>(
  matches: M[],
  previouslyAbsentIds: Iterable<string>,
  absentIds: Set<string>
):
  | { ok: true; kept: M[]; dissolved: M[]; toPair: string[]; inRound: Set<string> }
  | { ok: false; error: "not-in-round"; playerIds: string[] }
  | { ok: false; error: "started"; playerIds: string[] } {
  const inRound = new Set<string>();
  for (const m of matches) {
    inRound.add(m.player1Id);
    if (m.player2Id) inRound.add(m.player2Id);
  }
  for (const id of previouslyAbsentIds) inRound.add(id);

  const strangers = [...absentIds].filter((id) => !inRound.has(id));
  if (strangers.length > 0) return { ok: false, error: "not-in-round", playerIds: strangers };

  const kept: M[] = [];
  const dissolved: M[] = [];
  for (const m of matches) {
    const absentHere = [m.player1Id, m.player2Id].filter((id): id is string => !!id && absentIds.has(id));
    if (matchStarted(m)) {
      if (absentHere.length > 0) return { ok: false, error: "started", playerIds: absentHere };
      kept.push(m);
    } else if (m.isBye || !m.player2Id || absentHere.length > 0) {
      dissolved.push(m);
    } else {
      kept.push(m);
    }
  }

  const seated = new Set(kept.flatMap((m) => [m.player1Id, m.player2Id].filter((id): id is string => !!id)));
  const toPair = [...inRound].filter((id) => !absentIds.has(id) && !seated.has(id));
  return { ok: true, kept, dissolved, toPair, inRound };
}
