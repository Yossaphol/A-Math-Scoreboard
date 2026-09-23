import type { PairResult, Standing } from "./types";

function pairSequential(ids: string[]): PairResult[] {
  const results: PairResult[] = [];
  for (let i = 0; i < ids.length; i += 2) {
    if (i + 1 < ids.length) {
      results.push({ player1Id: ids[i], player2Id: ids[i + 1] });
    } else {
      results.push({ player1Id: ids[i], player2Id: null }); // odd one out => Bye
    }
  }
  return results;
}

function shuffled<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function rankOrder(standings: Standing[]): Standing[] {
  return [...standings].sort(
    (a, b) => b.points - a.points || b.diff - a.diff || a.tournamentPlayerNo - b.tournamentPlayerNo
  );
}

// Spec §9.1: shuffle Active players, then pair in the shuffled order.
export function randomPairing(standings: Standing[]): PairResult[] {
  return pairSequential(shuffled(standings.map((s) => s.id)));
}

// Spec §9.2: pair by rank order (1v2, 3v4, ...) — no rematch avoidance, no Swiss grouping.
export function kingOfTheHillPairing(standings: Standing[]): PairResult[] {
  return pairSequential(rankOrder(standings).map((s) => s.id));
}

// Spec §9.3, as the organizer runs it: split the ranking into score groups (same points) and
// fold each group — top half vs bottom half in order, so {1,2,3,4} plays 1-3, 2-4. A group
// with an odd count pulls up the highest-ranked player of the next group (the best Diff among
// the lower points). Rematches are deliberately NOT avoided — the pairing always follows the
// fold, and staff can still swap players in Preview. Round 1 (everyone 0/0) folds by
// tournamentPlayerNo, the last tie-break in rankOrder.
export function swissPairing(standings: Standing[]): PairResult[] {
  const ranked = rankOrder(standings);
  // Odd count: the lowest-ranked player always takes the Bye, before any grouping.
  const byePlayer = ranked.length % 2 === 1 ? ranked.pop() : undefined;

  const results: PairResult[] = [];
  let start = 0;
  while (start < ranked.length) {
    let end = start;
    while (end < ranked.length && ranked[end].points === ranked[start].points) end++;
    // Can't overrun: every group before this one had an even count and ranked.length is even.
    if ((end - start) % 2 === 1) end++;

    const group = ranked.slice(start, end);
    const half = group.length / 2;
    for (let i = 0; i < half; i++) {
      results.push({ player1Id: group[i].id, player2Id: group[i + half].id });
    }
    start = end;
  }

  if (byePlayer) results.push({ player1Id: byePlayer.id, player2Id: null });
  return results;
}

function rotateRight<T>(arr: T[], shift: number): T[] {
  const n = arr.length;
  if (n === 0) return arr;
  const s = ((shift % n) + n) % n;
  return [...arr.slice(n - s), ...arr.slice(0, n - s)];
}

// Spec §9.4: circle method — every pair meets exactly once over (n-1) rounds (n even) or
// n rounds (n odd, one Bye seat per round). Schedule depends only on player order and the
// round number, not on results.
export function roundRobinPairing(standings: Standing[], roundNumber: number): PairResult[] {
  const byNo = [...standings].sort((a, b) => a.tournamentPlayerNo - b.tournamentPlayerNo);
  const seats: (string | null)[] = byNo.map((s) => s.id);
  if (seats.length % 2 === 1) seats.push(null); // virtual Bye seat

  const n = seats.length;
  const totalRounds = n - 1;
  const roundIndex = (roundNumber - 1) % totalRounds;

  const fixed = seats[0];
  const rotating = rotateRight(seats.slice(1), roundIndex);
  const arranged = [fixed, ...rotating];

  const results: PairResult[] = [];
  for (let i = 0; i < n / 2; i++) {
    const a = arranged[i];
    const b = arranged[n - 1 - i];
    if (a == null && b == null) continue;
    if (a == null) results.push({ player1Id: b!, player2Id: null });
    else if (b == null) results.push({ player1Id: a, player2Id: null });
    else results.push({ player1Id: a, player2Id: b });
  }
  return results;
}
