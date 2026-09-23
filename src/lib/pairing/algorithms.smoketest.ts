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

// Swiss fixtures: player N is ranked N-th (Diff falls down the list), so expected pairings read
// in the organizer's own rank notation — "1-3 2-4" means rank 1 vs rank 3, rank 2 vs rank 4.
function rankedStandings(pointsByRank: number[]): Standing[] {
  return makeStandings(pointsByRank.map((points, i) => ({ no: i + 1, points, diff: -i })));
}

function repeat(points: number, count: number): number[] {
  return Array.from({ length: count }, () => points);
}

function foldPairs(from: number, to: number): string[] {
  const half = (to - from + 1) / 2;
  return Array.from({ length: half }, (_, i) => `${from + i}-${from + half + i}`);
}

function expectPairs(
  label: string,
  standings: Standing[],
  results: { player1Id: string; player2Id: string | null }[],
  expected: string[]
) {
  assertAllPaired(standings, results);
  const got = results
    .map((r) => `${r.player1Id.slice(1)}-${r.player2Id ? r.player2Id.slice(1) : "BYE"}`)
    .join(" ");
  if (got !== expected.join(" ")) {
    throw new Error(`${label}: expected "${expected.join(" ")}", got "${got}"`);
  }
  console.log(`${label}: OK`);
}

// --- Swiss: 8 players, round 2 — {1-4} at 2 points, {5-8} at 0, each group folds in half ---
{
  const standings = rankedStandings([...repeat(2, 4), ...repeat(0, 4)]);
  expectPairs("swiss (8 players, round 2)", standings, swissPairing(standings), [
    "1-3", "2-4", "5-7", "6-8",
  ]);
}

// --- Swiss: 8 players, round 3 — 4 points x2, 2 points x4, 0 points x2 ---
{
  const standings = rankedStandings([...repeat(4, 2), ...repeat(2, 4), ...repeat(0, 2)]);
  expectPairs("swiss (8 players, round 3)", standings, swissPairing(standings), [
    "1-2", "3-5", "4-6", "7-8",
  ]);
}

// --- Swiss: 30 players, round 2 — 15 winners is odd, so rank 16 (best Diff at 0) floats up ---
{
  const standings = rankedStandings([...repeat(2, 15), ...repeat(0, 15)]);
  expectPairs("swiss (30 players, round 2, float up)", standings, swissPairing(standings), [
    ...foldPairs(1, 16),
    ...foldPairs(17, 30),
  ]);
}

// --- Swiss: 30 players, round 3 — 4pt x8, 2pt x15 (+ rank 24 floats up), 0pt x7 -> 6 left ---
{
  const standings = rankedStandings([...repeat(4, 8), ...repeat(2, 15), ...repeat(0, 7)]);
  expectPairs("swiss (30 players, round 3, float up)", standings, swissPairing(standings), [
    ...foldPairs(1, 8),
    ...foldPairs(9, 24),
    ...foldPairs(25, 30),
  ]);
}

// --- Swiss: the floater is the best Diff of the lower group, not the lowest player number ---
{
  const standings = makeStandings([
    { no: 1, points: 2, diff: 90 },
    { no: 2, points: 2, diff: 60 },
    { no: 3, points: 2, diff: 30 },
    { no: 4, points: 0, diff: -50 },
    { no: 5, points: 0, diff: 30 },
    { no: 6, points: 0, diff: 0 },
  ]);
  // rank: p1 p2 p3 | p5 p6 p4 -> {p1 p2 p3 p5} folds 1-3 2-5, then {p6 p4}
  expectPairs("swiss (floater by Diff)", standings, swissPairing(standings), ["1-3", "2-5", "6-4"]);
}

// --- Swiss: round 1 (everyone 0/0) folds by player number, whatever order the input is in ---
{
  const standings = makeStandings([5, 2, 8, 1, 7, 4, 6, 3].map((no) => ({ no, points: 0, diff: 0 })));
  expectPairs("swiss (round 1 by player number)", standings, swissPairing(standings), [
    "1-5", "2-6", "3-7", "4-8",
  ]);
}

// --- Swiss: rematches are kept — the fold is never rearranged to dodge a previous opponent ---
{
  const standings = makeStandings([
    { no: 1, points: 2, diff: 3, opponents: [3] },
    { no: 2, points: 2, diff: 2 },
    { no: 3, points: 2, diff: 1, opponents: [1] },
    { no: 4, points: 2, diff: 0 },
  ]);
  expectPairs("swiss (rematch kept)", standings, swissPairing(standings), ["1-3", "2-4"]);
}

// --- Swiss: odd count — the lowest-ranked player takes the Bye even if they already had one ---
{
  const standings = rankedStandings([...repeat(2, 3), ...repeat(0, 4)]);
  standings[6].hadBye = true;
  expectPairs("swiss (odd count, bye to last rank)", standings, swissPairing(standings), [
    "1-3", "2-4", "5-6", "7-BYE",
  ]);
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
