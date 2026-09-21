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

function rankOrder(standings: Standing[]): Standing[] {
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

// Spec §9.3: group by standing, prefer nearest-ranked unplayed opponent, resolve
// unavoidable rematches by falling back to the nearest available opponent.
export function swissPairing(standings: Standing[]): PairResult[] {
  const ranked = rankOrder(standings);

  let pool = ranked;
  let byePlayer: Standing | undefined;
  if (pool.length % 2 === 1) {
    // Give the bye to the lowest-ranked player who hasn't had one yet (spec §9.3 point 7).
    for (let i = pool.length - 1; i >= 0; i--) {
      if (!pool[i].hadBye) {
        byePlayer = pool[i];
        break;
      }
    }
    byePlayer ??= pool[pool.length - 1];
    pool = pool.filter((p) => p.id !== byePlayer!.id);
  }

  const results: PairResult[] = [];
  const remaining = [...pool];
  while (remaining.length > 0) {
    const current = remaining.shift()!;
    let opponentIndex = remaining.findIndex((p) => !current.opponents.has(p.id));
    if (opponentIndex === -1) opponentIndex = 0; // unavoidable rematch — nearest by rank
    const [opponent] = remaining.splice(opponentIndex, 1);
    results.push({ player1Id: current.id, player2Id: opponent.id });
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
