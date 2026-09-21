import {
  randomPairing,
  kingOfTheHillPairing,
  swissPairing,
  roundRobinPairing,
} from "./algorithms";
import type { Standing } from "./types";

function makeStandings(
  specs: { no: number; points: number; diff: number; opponents?: number[]; hadBye?: boolean }[]
): Standing[] {
  return specs.map((s) => ({
    id: `p${s.no}`,
    tournamentPlayerNo: s.no,
    points: s.points,
    diff: s.diff,
    opponents: new Set((s.opponents ?? []).map((n) => `p${n}`)),
    hadBye: s.hadBye ?? false,
  }));
}

function assertAllPaired(standings: Standing[], results: { player1Id: string; player2Id: string | null }[]) {
  const seen = new Set<string>();
  for (const r of results) {
    if (seen.has(r.player1Id)) throw new Error(`player used twice: ${r.player1Id}`);
    seen.add(r.player1Id);
    if (r.player2Id) {
      if (seen.has(r.player2Id)) throw new Error(`player used twice: ${r.player2Id}`);
      seen.add(r.player2Id);
    }
  }
  if (seen.size !== standings.length) {
    throw new Error(`expected ${standings.length} players placed, got ${seen.size}`);
  }
}

// --- Random: even count, no byes ---
{
  const standings = makeStandings([1, 2, 3, 4, 5, 6].map((no) => ({ no, points: 0, diff: 0 })));
  const results = randomPairing(standings);
  assertAllPaired(standings, results);
  if (results.some((r) => r.player2Id == null)) throw new Error("even count should have no bye");
  console.log("random (even): OK");
}

// --- Random: odd count, exactly one bye ---
{
  const standings = makeStandings([1, 2, 3, 4, 5].map((no) => ({ no, points: 0, diff: 0 })));
  const results = randomPairing(standings);
  assertAllPaired(standings, results);
  const byes = results.filter((r) => r.player2Id == null);
  if (byes.length !== 1) throw new Error(`expected exactly 1 bye, got ${byes.length}`);
  console.log("random (odd): OK");
}

// --- King of the Hill: pairs by rank, 1v2 3v4 ---
{
  const standings = makeStandings([
    { no: 1, points: 4, diff: 10 },
    { no: 2, points: 6, diff: 5 },
    { no: 3, points: 6, diff: 20 },
    { no: 4, points: 2, diff: 0 },
  ]);
  const results = kingOfTheHillPairing(standings);
  // rank order should be p3(6/20), p2(6/5), p1(4/10), p4(2/0) -> pairs (p3,p2) (p1,p4)
  if (results[0].player1Id !== "p3" || results[0].player2Id !== "p2") {
    throw new Error(`KOTH pairing order wrong: ${JSON.stringify(results)}`);
  }
  if (results[1].player1Id !== "p1" || results[1].player2Id !== "p4") {
    throw new Error(`KOTH pairing order wrong: ${JSON.stringify(results)}`);
  }
  console.log("king of the hill: OK");
}

// --- Swiss: avoids rematch when possible ---
{
  const standings = makeStandings([
    { no: 1, points: 4, diff: 0, opponents: [2] },
    { no: 2, points: 4, diff: 0, opponents: [1] },
    { no: 3, points: 2, diff: 0, opponents: [4] },
    { no: 4, points: 2, diff: 0, opponents: [3] },
  ]);
  const results = swissPairing(standings);
  assertAllPaired(standings, results);
  for (const r of results) {
    if (r.player2Id) {
      const a = standings.find((s) => s.id === r.player1Id)!;
      if (a.opponents.has(r.player2Id)) {
        throw new Error(`swiss produced an avoidable rematch: ${r.player1Id} vs ${r.player2Id}`);
      }
    }
  }
  console.log("swiss (avoidable rematch avoided): OK");
}

// --- Swiss: unavoidable rematch still pairs everyone ---
{
  // Everyone has already played everyone else once (round-robin of 4) -> any pairing is a rematch.
  const standings = makeStandings([
    { no: 1, points: 4, diff: 0, opponents: [2, 3, 4] },
    { no: 2, points: 4, diff: 0, opponents: [1, 3, 4] },
    { no: 3, points: 2, diff: 0, opponents: [1, 2, 4] },
    { no: 4, points: 2, diff: 0, opponents: [1, 2, 3] },
  ]);
  const results = swissPairing(standings);
  assertAllPaired(standings, results);
  console.log("swiss (unavoidable rematch still resolves): OK");
}

// --- Swiss: odd count gives exactly one bye, prefers player without prior bye ---
{
  const standings = makeStandings([
    { no: 1, points: 4, diff: 0 },
    { no: 2, points: 4, diff: 0 },
    { no: 3, points: 2, diff: 0, hadBye: true },
    { no: 4, points: 2, diff: 0 },
    { no: 5, points: 0, diff: 0 },
  ]);
  const results = swissPairing(standings);
  assertAllPaired(standings, results);
  const bye = results.find((r) => r.player2Id == null);
  if (!bye) throw new Error("expected a bye");
  if (bye.player1Id === "p3") throw new Error("bye should skip the player who already had one");
  console.log("swiss (bye avoids repeat): OK");
}

// --- Round Robin: 4 players, every pair meets exactly once over 3 rounds ---
{
  const standings = makeStandings([1, 2, 3, 4].map((no) => ({ no, points: 0, diff: 0 })));
  const seenPairs = new Set<string>();
  for (let round = 1; round <= 3; round++) {
    const results = roundRobinPairing(standings, round);
    assertAllPaired(standings, results);
    for (const r of results) {
      const key = [r.player1Id, r.player2Id].sort().join("-");
      if (seenPairs.has(key)) throw new Error(`round robin repeated a pair: ${key}`);
      seenPairs.add(key);
    }
  }
  const expectedPairs = (4 * 3) / 2;
  if (seenPairs.size !== expectedPairs) {
    throw new Error(`expected ${expectedPairs} unique pairs, got ${seenPairs.size}`);
  }
  console.log("round robin (4 players, full coverage): OK");
}

// --- Round Robin: 5 players (odd), each round has exactly one bye, full coverage over 5 rounds ---
{
  const standings = makeStandings([1, 2, 3, 4, 5].map((no) => ({ no, points: 0, diff: 0 })));
  const seenPairs = new Set<string>();
  const byeCounts = new Map<string, number>();
  for (let round = 1; round <= 5; round++) {
    const results = roundRobinPairing(standings, round);
    assertAllPaired(standings, results);
    const byes = results.filter((r) => r.player2Id == null);
    if (byes.length !== 1) throw new Error(`round ${round}: expected 1 bye, got ${byes.length}`);
    byeCounts.set(byes[0].player1Id, (byeCounts.get(byes[0].player1Id) ?? 0) + 1);
    for (const r of results) {
      if (!r.player2Id) continue;
      const key = [r.player1Id, r.player2Id].sort().join("-");
      if (seenPairs.has(key)) throw new Error(`round robin repeated a pair: ${key}`);
      seenPairs.add(key);
    }
  }
  const expectedPairs = (5 * 4) / 2;
  if (seenPairs.size !== expectedPairs) {
    throw new Error(`expected ${expectedPairs} unique pairs, got ${seenPairs.size}`);
  }
  if ([...byeCounts.values()].some((c) => c !== 1)) {
    throw new Error(`expected each of the 5 players to get exactly 1 bye: ${JSON.stringify([...byeCounts])}`);
  }
  console.log("round robin (5 players, odd, full coverage + fair byes): OK");
}

console.log("\nAll pairing algorithm smoke tests passed.");
