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

type SwissCase = {
  title: string;
  standings: Standing[];
  // Player numbers (not ids), organizer notation: "1-3" = player 1 vs player 3, "7-BYE" = Bye.
  expected: string[];
};

// Player N is ranked N-th (Diff falls down the list, positive in the top half and negative in
// the bottom half like a real field), so player numbers double as ranks — the notation the
// organizer uses ("1-3 2-4" = rank 1 vs rank 3, rank 2 vs rank 4).
function rankedStandings(pointsByRank: number[]): Standing[] {
  const mid = pointsByRank.length / 2;
  return makeStandings(
    pointsByRank.map((points, i) => ({ no: i + 1, points, diff: (mid - i) * 20 - 10 }))
  );
}

function repeat(points: number, count: number): number[] {
  return Array.from({ length: count }, () => points);
}

function foldPairs(from: number, to: number): string[] {
  const half = (to - from + 1) / 2;
  return Array.from({ length: half }, (_, i) => `${from + i}-${from + half + i}`);
}

function pairLabel(r: { player1Id: string; player2Id: string | null }): string {
  return `${r.player1Id.slice(1)}-${r.player2Id ? r.player2Id.slice(1) : "BYE"}`;
}

const SWISS_CASES: SwissCase[] = [
  {
    // ยังไม่มีผล ใช้เลขผู้เล่นเรียงลำดับ แล้วแบ่งครึ่ง {1-4} {5-8} (ส่งข้อมูลเข้าแบบสลับลำดับไว้ ผลต้องไม่เปลี่ยน)
    title: "8 คน · เกม 1 (ทุกคน 0 แต้ม)",
    standings: makeStandings([5, 2, 8, 1, 7, 4, 6, 3].map((no) => ({ no, points: 0, diff: 0 }))),
    expected: ["1-5", "2-6", "3-7", "4-8"],
  },
  {
    // กลุ่ม 2 แต้ม {1,2}{3,4} → 1-3, 2-4 · กลุ่ม 0 แต้ม {5,6}{7,8} → 5-7, 6-8
    title: "8 คน · เกม 2",
    standings: rankedStandings([...repeat(2, 4), ...repeat(0, 4)]),
    expected: ["1-3", "2-4", "5-7", "6-8"],
  },
  {
    // 4 แต้ม 2 คนเจอกันเอง · 2 แต้ม 4 คน {3,4}{5,6} → 3-5, 4-6 · 0 แต้มเจอกันเอง
    title: "8 คน · เกม 3",
    standings: rankedStandings([...repeat(4, 2), ...repeat(2, 4), ...repeat(0, 2)]),
    expected: ["1-2", "3-5", "4-6", "7-8"],
  },
  {
    // 2 แต้มมี 15 คน (คี่) → ดึงอันดับ 16 (Diff สูงสุดของกลุ่ม 0 แต้ม) ขึ้นมา {1-8}{9-16} · กลุ่มล่างเหลือ {17-23}{24-30}
    title: "30 คน · เกม 2 (ดึงขึ้น 1 คน)",
    standings: rankedStandings([...repeat(2, 15), ...repeat(0, 15)]),
    expected: [...foldPairs(1, 16), ...foldPairs(17, 30)],
  },
  {
    // 4 แต้ม {1-8} → 1-5..4-8 · 2 แต้ม 15 คน ดึงอันดับ 24 ขึ้นมา {9-16}{17-24} · 0 แต้มเหลือ {25-30} → 25-28, 26-29, 27-30
    title: "30 คน · เกม 3 (ดึงขึ้นต่อกัน)",
    standings: rankedStandings([...repeat(4, 8), ...repeat(2, 15), ...repeat(0, 7)]),
    expected: [...foldPairs(1, 8), ...foldPairs(9, 24), ...foldPairs(25, 30)],
  },
  {
    // 2 แต้ม 3 คน ดึงคนแรกของ 1 แต้ม (#4) ขึ้นมา → 1-3, 2-4 · 1 แต้มเหลือ #5 คนเดียว ดึง #6 ขึ้นมา → 5-6 · 0 แต้ม 7-8
    title: "มีเสมอ (กลุ่ม 1 แต้ม) · ดึงขึ้นหลายชั้น",
    standings: rankedStandings([2, 2, 2, 1, 1, 0, 0, 0]),
    expected: ["1-3", "2-4", "5-6", "7-8"],
  },
  {
    // กลุ่ม 0 แต้มคือ #4 (Diff -50), #5 (+30), #6 (0) → #5 ได้อันดับ 4 จึงถูกดึงขึ้นไปเจอ #2 ไม่ใช่ #4 ที่เลขน้อยกว่า
    title: "คนที่ถูกดึงขึ้น = Diff สูงสุดของกลุ่มล่าง",
    standings: makeStandings([
      { no: 1, points: 2, diff: 90 },
      { no: 2, points: 2, diff: 60 },
      { no: 3, points: 2, diff: 30 },
      { no: 4, points: 0, diff: -50 },
      { no: 5, points: 0, diff: 30 },
      { no: 6, points: 0, diff: 0 },
    ]),
    expected: ["1-3", "2-5", "6-4"],
  },
  {
    // #1 กับ #3 เคยเจอกันแล้ว แต่ระบบไม่สลับหนี — ยังได้ 1-3, 2-4 (สลับเองได้ในหน้า Preview)
    title: "เคยเจอกันแล้วก็ยังจับตามสูตร",
    standings: makeStandings([
      { no: 1, points: 2, diff: 3, opponents: [3] },
      { no: 2, points: 2, diff: 2 },
      { no: 3, points: 2, diff: 1, opponents: [1] },
      { no: 4, points: 2, diff: 0 },
    ]),
    expected: ["1-3", "2-4"],
  },
  {
    // #7 อันดับสุดท้ายได้ Bye แม้เคยได้มาแล้ว ถูกตัดออกก่อนแบ่งกลุ่ม · 2 แต้ม 3 คนดึง #4 ขึ้นมา → 1-3, 2-4 · เหลือ 5-6
    title: "จำนวนคี่ · Bye ให้อันดับสุดท้ายเสมอ",
    standings: (() => {
      const standings = rankedStandings([...repeat(2, 3), ...repeat(0, 4)]);
      standings[6].hadBye = true;
      return standings;
    })(),
    expected: ["1-3", "2-4", "5-6", "7-BYE"],
  },
];

// --- Swiss: every case above ---
for (const c of SWISS_CASES) {
  const results = swissPairing(c.standings);
  assertAllPaired(c.standings, results);
  const got = results.map(pairLabel).join(" ");
  if (got !== c.expected.join(" ")) {
    throw new Error(`swiss "${c.title}": expected "${c.expected.join(" ")}", got "${got}"`);
  }
  console.log(`swiss (${c.title}): OK`);
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
