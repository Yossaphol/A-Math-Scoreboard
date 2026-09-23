"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { inputClass, labelClass } from "@/components/ui/styles";
import { rankOrder, swissPairing } from "@/lib/pairing/algorithms";
import { cappedDiff } from "@/lib/match/diff";
import type { PairResult, Standing } from "@/lib/pairing/types";
import { PairList, StandingsTable, type WtlRecord } from "./SwissBoard";

type Game = { player1Id: string; player2Id: string | null; score1: number; score2: number };

type SimRound = {
  roundNumber: number;
  ranked: Standing[];
  records: Map<string, WtlRecord>;
  pairs: PairResult[];
  scores: ([number, number] | null)[];
};

// Deterministic PRNG (mulberry32) so a seed reproduces the exact same tournament.
function seededRandom(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Mirrors getStandingsForPairing (src/lib/pairing/standings.ts) on in-memory games:
// W=2 T=1 L=0, Bye = W with Diff +100, Diff capped by Maximum Score per game.
function standingsFrom(playerCount: number, games: Game[], maximumScore: number) {
  const standings = new Map<string, Standing>();
  const records = new Map<string, WtlRecord>();
  for (let no = 1; no <= playerCount; no++) {
    const id = `p${no}`;
    standings.set(id, { id, tournamentPlayerNo: no, points: 0, diff: 0, opponents: new Set(), hadBye: false });
    records.set(id, { w: 0, t: 0, l: 0 });
  }

  for (const g of games) {
    const p1 = standings.get(g.player1Id)!;
    const r1 = records.get(g.player1Id)!;
    if (!g.player2Id) {
      p1.points += 2;
      p1.diff += 100;
      p1.hadBye = true;
      r1.w++;
      continue;
    }
    const p2 = standings.get(g.player2Id)!;
    const r2 = records.get(g.player2Id)!;
    p1.opponents.add(p2.id);
    p2.opponents.add(p1.id);

    const diff = cappedDiff(g.score1, g.score2, maximumScore > 0, maximumScore);
    p1.diff += diff;
    p2.diff -= diff;
    if (g.score1 === g.score2) {
      p1.points += 1;
      p2.points += 1;
      r1.t++;
      r2.t++;
    } else if (g.score1 > g.score2) {
      p1.points += 2;
      r1.w++;
      r2.l++;
    } else {
      p2.points += 2;
      r2.w++;
      r1.l++;
    }
  }

  return { standings: [...standings.values()], records };
}

function simulate(playerCount: number, roundCount: number, maximumScore: number, seed: number) {
  const random = seededRandom(seed);
  const score = () => 250 + Math.floor(random() * 251);
  const games: Game[] = [];
  const rounds: SimRound[] = [];

  for (let roundNumber = 1; roundNumber <= roundCount; roundNumber++) {
    const { standings, records } = standingsFrom(playerCount, games, maximumScore);
    const pairs = swissPairing(standings);
    const scores = pairs.map((p): [number, number] | null => (p.player2Id ? [score(), score()] : null));
    pairs.forEach((p, i) => {
      const s = scores[i];
      games.push({ player1Id: p.player1Id, player2Id: p.player2Id, score1: s?.[0] ?? 0, score2: s?.[1] ?? 0 });
    });
    rounds.push({ roundNumber, ranked: rankOrder(standings), records, pairs, scores });
  }

  const final = standingsFrom(playerCount, games, maximumScore);
  return { rounds, finalRanked: rankOrder(final.standings), finalRecords: final.records };
}

function clampInt(value: string, min: number, max: number, fallback: number) {
  const n = Number.parseInt(value, 10);
  return Number.isNaN(n) ? fallback : Math.min(max, Math.max(min, n));
}

export function SwissSimulator() {
  // Raw input text, clamped only when read — so a field can be cleared while typing.
  const [playerText, setPlayerText] = useState("8");
  const [roundText, setRoundText] = useState("4");
  const [maxScoreText, setMaxScoreText] = useState("350");
  const [seedText, setSeedText] = useState("1");

  const playerCount = clampInt(playerText, 2, 64, 8);
  const roundCount = clampInt(roundText, 1, 12, 4);
  const maximumScore = clampInt(maxScoreText, 0, 10000, 0);
  const seed = clampInt(seedText, 0, 2 ** 31 - 1, 1);

  const { rounds, finalRanked, finalRecords } = useMemo(
    () => simulate(playerCount, roundCount, maximumScore, seed),
    [playerCount, roundCount, maximumScore, seed]
  );

  return (
    <div className="space-y-4">
      <Card padding="p-4" className="flex flex-wrap items-end gap-3">
        <label className="w-24">
          <span className={labelClass}>ผู้เล่น</span>
          <input
            type="number"
            min={2}
            max={64}
            value={playerText}
            onChange={(e) => setPlayerText(e.target.value)}
            className={`${inputClass} mt-1`}
          />
        </label>
        <label className="w-24">
          <span className={labelClass}>จำนวนเกม</span>
          <input
            type="number"
            min={1}
            max={12}
            value={roundText}
            onChange={(e) => setRoundText(e.target.value)}
            className={`${inputClass} mt-1`}
          />
        </label>
        <label className="w-32">
          <span className={labelClass}>Maximum Score (0 = ปิด)</span>
          <input
            type="number"
            min={0}
            value={maxScoreText}
            onChange={(e) => setMaxScoreText(e.target.value)}
            className={`${inputClass} mt-1`}
          />
        </label>
        <label className="w-28">
          <span className={labelClass}>Seed</span>
          <input
            type="number"
            value={seedText}
            onChange={(e) => setSeedText(e.target.value)}
            className={`${inputClass} mt-1`}
          />
        </label>
        <Button type="button" onClick={() => setSeedText(String(Math.floor(Math.random() * 1_000_000)))}>
          สุ่มผลใหม่
        </Button>
        <p className="basis-full text-xs text-neutral-500">
          คะแนนแต่ละเกมสุ่ม 250–500 ต่อคน (เท่ากัน = เสมอ) · Seed เดิมได้ผลเดิมทุกครั้ง ถ้าเจอเคสแปลกจด Seed ไว้ได้
        </p>
      </Card>

      {rounds.map((round) => (
        <Card key={round.roundNumber} padding="p-4">
          <h3 className="mb-3 text-sm font-semibold text-neutral-900">เกม {round.roundNumber}</h3>
          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <p className="mb-1.5 text-xs text-neutral-500">อันดับก่อนจับคู่</p>
              <StandingsTable ranked={round.ranked} records={round.records} />
            </div>
            <div>
              <p className="mb-1.5 text-xs text-neutral-500">คู่ที่ swissPairing จับ + ผลที่สุ่ม</p>
              <PairList ranked={round.ranked} pairs={round.pairs} scores={round.scores} />
            </div>
          </div>
        </Card>
      ))}

      <Card padding="p-4">
        <h3 className="mb-3 text-sm font-semibold text-neutral-900">อันดับหลังเกม {roundCount}</h3>
        <StandingsTable ranked={finalRanked} records={finalRecords} />
      </Card>
    </div>
  );
}
