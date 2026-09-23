import type { Standing } from "./types";

// Shared by algorithms.smoketest.ts (asserts them) and /dev/swiss (shows them side by side
// with the live swissPairing output), so the page and the tests can never disagree.

export type SwissCase = {
  title: string;
  note: string;
  standings: Standing[];
  // Player numbers (not ids), organizer notation: "1-3" = player 1 vs player 3, "7-BYE" = Bye.
  expected: string[];
};

export function makeStandings(
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

export function pairLabel(r: { player1Id: string; player2Id: string | null }): string {
  return `${r.player1Id.slice(1)}-${r.player2Id ? r.player2Id.slice(1) : "BYE"}`;
}

export const SWISS_CASES: SwissCase[] = [
  {
    title: "8 คน · เกม 1 (ทุกคน 0 แต้ม)",
    note: "ยังไม่มีผล ใช้เลขผู้เล่นเรียงลำดับ แล้วแบ่งครึ่ง {1-4} {5-8} (ส่งข้อมูลเข้าแบบสลับลำดับไว้ ผลต้องไม่เปลี่ยน)",
    standings: makeStandings([5, 2, 8, 1, 7, 4, 6, 3].map((no) => ({ no, points: 0, diff: 0 }))),
    expected: ["1-5", "2-6", "3-7", "4-8"],
  },
  {
    title: "8 คน · เกม 2",
    note: "กลุ่ม 2 แต้ม {1,2}{3,4} → 1-3, 2-4 · กลุ่ม 0 แต้ม {5,6}{7,8} → 5-7, 6-8",
    standings: rankedStandings([...repeat(2, 4), ...repeat(0, 4)]),
    expected: ["1-3", "2-4", "5-7", "6-8"],
  },
  {
    title: "8 คน · เกม 3",
    note: "4 แต้ม 2 คนเจอกันเอง · 2 แต้ม 4 คน {3,4}{5,6} → 3-5, 4-6 · 0 แต้มเจอกันเอง",
    standings: rankedStandings([...repeat(4, 2), ...repeat(2, 4), ...repeat(0, 2)]),
    expected: ["1-2", "3-5", "4-6", "7-8"],
  },
  {
    title: "30 คน · เกม 2 (ดึงขึ้น 1 คน)",
    note: "2 แต้มมี 15 คน (คี่) → ดึงอันดับ 16 (Diff สูงสุดของกลุ่ม 0 แต้ม) ขึ้นมา {1-8}{9-16} · กลุ่มล่างเหลือ {17-23}{24-30}",
    standings: rankedStandings([...repeat(2, 15), ...repeat(0, 15)]),
    expected: [...foldPairs(1, 16), ...foldPairs(17, 30)],
  },
  {
    title: "30 คน · เกม 3 (ดึงขึ้นต่อกัน)",
    note: "4 แต้ม {1-8} → 1-5..4-8 · 2 แต้ม 15 คน ดึงอันดับ 24 ขึ้นมา {9-16}{17-24} · 0 แต้มเหลือ {25-30} → 25-28, 26-29, 27-30",
    standings: rankedStandings([...repeat(4, 8), ...repeat(2, 15), ...repeat(0, 7)]),
    expected: [...foldPairs(1, 8), ...foldPairs(9, 24), ...foldPairs(25, 30)],
  },
  {
    title: "มีเสมอ (กลุ่ม 1 แต้ม) · ดึงขึ้นหลายชั้น",
    note: "2 แต้ม 3 คน ดึงคนแรกของ 1 แต้ม (#4) ขึ้นมา → 1-3, 2-4 · 1 แต้มเหลือ #5 คนเดียว ดึง #6 ขึ้นมา → 5-6 · 0 แต้ม 7-8",
    standings: rankedStandings([2, 2, 2, 1, 1, 0, 0, 0]),
    expected: ["1-3", "2-4", "5-6", "7-8"],
  },
  {
    title: "คนที่ถูกดึงขึ้น = Diff สูงสุดของกลุ่มล่าง",
    note: "กลุ่ม 0 แต้มคือ #4 (Diff -50), #5 (+30), #6 (0) → #5 ได้อันดับ 4 จึงถูกดึงขึ้นไปเจอ #2 ไม่ใช่ #4 ที่เลขน้อยกว่า",
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
    title: "เคยเจอกันแล้วก็ยังจับตามสูตร",
    note: "#1 กับ #3 เคยเจอกันแล้ว แต่ระบบไม่สลับหนี — ยังได้ 1-3, 2-4 (สลับเองได้ในหน้า Preview)",
    standings: makeStandings([
      { no: 1, points: 2, diff: 3, opponents: [3] },
      { no: 2, points: 2, diff: 2 },
      { no: 3, points: 2, diff: 1, opponents: [1] },
      { no: 4, points: 2, diff: 0 },
    ]),
    expected: ["1-3", "2-4"],
  },
  {
    title: "จำนวนคี่ · Bye ให้อันดับสุดท้ายเสมอ",
    note: "#7 อันดับสุดท้ายได้ Bye แม้เคยได้มาแล้ว ถูกตัดออกก่อนแบ่งกลุ่ม · 2 แต้ม 3 คนดึง #4 ขึ้นมา → 1-3, 2-4 · เหลือ 5-6",
    standings: (() => {
      const standings = rankedStandings([...repeat(2, 3), ...repeat(0, 4)]);
      standings[6].hadBye = true;
      return standings;
    })(),
    expected: ["1-3", "2-4", "5-6", "7-BYE"],
  },
];
