"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import s from "./HallScreen.module.css";

export type HallTable = {
  id: string;
  table: number | null;
  a: { name: string; no: number };
  b: { name: string; no: number } | null;
  state: "done" | "conflict" | "playing" | "bye";
  scoreA: number | null;
  scoreB: number | null;
};

export type HallStanding = {
  rank: number;
  // Set while the Scoreboard is split by group: rank is then within this group.
  group: string | null;
  name: string;
  nickname: string | null;
  points: number;
  wins: number;
  ties: number;
  losses: number;
  diff: number;
};

export type HallData = {
  tournamentName: string;
  tournamentDone: boolean;
  // The round on screen: the one in play, else the last one played. null before Round 1.
  round: { number: number; live: boolean } | null;
  tables: HallTable[];
  standings: HallStanding[];
  // Bottom-right QR into the site, so people in the hall can follow on their phones.
  siteQr: { url: string; dataUrl: string };
};

const PAGE_MS = 10_000;
// While a round is in play the screen alternates tables ↔ standings…
const TABLES_MS = 25_000;
const STANDINGS_MS = 12_000;
// …but early on, people only need to find their table.
const PAIRING_ONLY_BELOW = 0.25;

type View = "tables" | "standings";
// "auto" lets the screen decide (below); the other two pin a view until changed.
type Mode = "auto" | View;
const MODES: { mode: Mode; label: string }[] = [
  { mode: "auto", label: "อัตโนมัติ" },
  { mode: "tables", label: "คู่แข่ง" },
  { mode: "standings", label: "อันดับ" },
];
// Per device: the TV keeps its choice across a reload. localStorage can be missing or throw;
// then the choice just doesn't survive one.
const MODE_KEY = "hall-screen-mode";
const modeListeners = new Set<() => void>();
let savedMode: Mode | null = null;
function getMode(): Mode {
  if (savedMode === null) {
    try {
      const v = localStorage.getItem(MODE_KEY);
      savedMode = v === "tables" || v === "standings" ? v : "auto";
    } catch {
      savedMode = "auto";
    }
  }
  return savedMode;
}
function saveMode(next: Mode) {
  savedMode = next;
  try {
    localStorage.setItem(MODE_KEY, next);
  } catch {}
  modeListeners.forEach((l) => l());
}
function subscribeMode(listener: () => void) {
  modeListeners.add(listener);
  return () => {
    modeListeners.delete(listener);
  };
}

/**
 * The hall's TV/projector screen (light, in the app's palette). The server page refreshes the data every few seconds; this
 * decides what's on screen: tables (who plays where, then live results) and standings, paged
 * so a big field fits without anyone scrolling.
 */
export function HallScreen({ data }: { data: HallData }) {
  const { round, tables, standings, siteQr } = data;
  const finished = tables.filter((t) => t.state === "done" || t.state === "bye").length;
  const share = tables.length ? finished / tables.length : 0;
  const rotate = !!round?.live && share >= PAIRING_ONLY_BELOW && standings.length > 0;
  // null = take turns. Before Round 1 there's nothing to show but standings (if any games were
  // logged); between rounds and at the end, standings; during play, tables (and standings once
  // enough of the round is in).
  let forcedView: View | null;
  if (!round) forcedView = standings.some((r) => r.wins + r.ties + r.losses > 0) ? "standings" : null;
  else if (!round.live) forcedView = "standings";
  else forcedView = rotate ? null : "tables";

  const mode = useSyncExternalStore(subscribeMode, getMode, () => "auto" as Mode);
  const [rotating, setRotating] = useState<View>("tables");
  const view: View = mode === "auto" ? (forcedView ?? rotating) : mode;
  const [page, setPage] = useState(0);
  function setMode(next: Mode) {
    saveMode(next);
    setPage(0);
  }
  const stageRef = useRef<HTMLElement>(null);
  const footerRef = useRef<HTMLElement>(null);
  const [fit, setFit] = useState({ tiles: 12, rows: 10, twoCols: true });

  // Tables ↔ standings while a round is under way.
  useEffect(() => {
    if (mode !== "auto" || !rotate) return;
    const t = setTimeout(
      () => {
        setRotating((v) => (v === "tables" ? "standings" : "tables"));
        setPage(0);
      },
      rotating === "tables" ? TABLES_MS : STANDINGS_MS
    );
    return () => clearTimeout(t);
  }, [mode, rotate, rotating]);

  // How many tiles / rows fit on one screen.
  const measure = useCallback(() => {
    const el = stageRef.current;
    if (!el) return;
    const w = el.clientWidth;
    const footer = footerRef.current?.offsetHeight ?? 90;
    const h = Math.max(240, window.innerHeight - el.getBoundingClientRect().top - footer - 30);
    const tileW = Math.min(340, Math.max(230, window.innerWidth * 0.22)) + 14;
    const tileH = Math.min(124, Math.max(84, window.innerWidth * 0.09)) + 14;
    const twoCols = window.innerWidth >= 1080;
    setFit({
      tiles: Math.max(4, Math.floor(w / tileW) * Math.max(2, Math.floor(h / tileH))),
      rows: Math.max(6, Math.floor((h - 30) / 62)) * (twoCols ? 2 : 1),
      twoCols,
    });
  }, []);
  useEffect(() => {
    measure();
    let t: ReturnType<typeof setTimeout>;
    const onResize = () => {
      clearTimeout(t);
      t = setTimeout(measure, 200);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [measure]);

  // During play, tables still going come first — that's what people in the hall look for.
  const orderedTables = round?.live
    ? [...tables].sort((x, y) => Number(x.state === "done" || x.state === "bye") - Number(y.state === "done" || y.state === "bye") || (x.table ?? 999) - (y.table ?? 999))
    : tables;
  const perPage = view === "tables" ? fit.tiles : fit.rows;
  const total = view === "tables" ? orderedTables.length : standings.length;
  const pages = Math.max(1, Math.ceil(total / perPage));
  const current = page % pages;

  useEffect(() => {
    if (pages <= 1) return;
    const t = setTimeout(() => setPage((p) => p + 1), PAGE_MS);
    return () => clearTimeout(t);
  }, [pages, current, view]);

  // Clock.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const t = setInterval(tick, 10_000);
    return () => clearInterval(t);
  }, []);

  // Keep the TV awake while this is open; ignore if the browser won't.
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    const request = async () => {
      try {
        lock = await (navigator as unknown as { wakeLock?: { request: (t: string) => Promise<typeof lock> } }).wakeLock?.request("screen") ?? null;
      } catch {}
    };
    request();
    const onVisible = () => document.visibilityState === "visible" && request();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      void lock?.release().catch(() => {});
    };
  }, []);

  // Hide the fullscreen button when the mouse rests.
  const [idle, setIdle] = useState(false);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const wake = () => {
      setIdle(false);
      clearTimeout(t);
      t = setTimeout(() => setIdle(true), 4000);
    };
    wake();
    window.addEventListener("pointermove", wake);
    window.addEventListener("pointerdown", wake);
    return () => {
      clearTimeout(t);
      window.removeEventListener("pointermove", wake);
      window.removeEventListener("pointerdown", wake);
    };
  }, []);

  const title = !round ? (
    view === "standings" ? <>อันดับ</> : <>รอประกาศคู่ Round 1</>
  ) : round.live ? (
    view === "tables" ? (
      <>
        Round {round.number} · <span className={s.phase}>{finished === 0 ? "ประกาศคู่" : "กำลังแข่ง"}</span>
      </>
    ) : (
      <>อันดับปัจจุบัน</>
    )
  ) : view === "tables" ? (
    <>
      Round {round.number} · <span className={s.phase}>ผลการแข่ง</span>
    </>
  ) : data.tournamentDone ? (
    <>
      <span className={s.phase}>อันดับสุดท้าย</span>
    </>
  ) : (
    <>อันดับหลัง Round {round.number}</>
  );

  return (
    <div className={`${s.screen} ${idle ? s.idle : ""}`}>
      <header className={s.top}>
        <div>
          <div className={s.eyebrow}>
            {data.tournamentName}
            {data.tournamentDone ? " · จบการแข่งขัน" : ""}
          </div>
          <h1 className={s.title}>{title}</h1>
        </div>
        <div className={s.clock}>
          <b>{now ? now.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }) : "--:--"}</b>
          <span>{now?.toLocaleDateString("th-TH", { weekday: "long", day: "numeric", month: "long" })}</span>
        </div>
        {round?.live && view === "tables" && (
          <div className={s.progress}>
            <div className={s.progressBar}>
              <i style={{ width: `${share * 100}%` }} />
            </div>
            <span>
              ยืนยันแล้ว <b>{finished}/{tables.length}</b> โต๊ะ
            </span>
          </div>
        )}
      </header>

      <main className={s.stage} ref={stageRef} aria-live="polite">
        {!round && view !== "standings" ? (
          <p className={s.empty}>
            <b>{data.tournamentName}</b>
            คู่แข่งขันจะขึ้นที่นี่เมื่อกรรมการยืนยัน Round 1
          </p>
        ) : view === "tables" ? (
          <div className={s.grid} key={`t${current}`}>
            {orderedTables.slice(current * perPage, current * perPage + perPage).map((t) => (
              <TableTile key={t.id} t={t} showResult={!!round} markPlaying={finished > 0} />
            ))}
          </div>
        ) : standings.length === 0 ? (
          <p className={s.empty}>ยังไม่มีอันดับ</p>
        ) : (
          <StandingsBoard rows={standings.slice(current * perPage, current * perPage + perPage)} twoCols={fit.twoCols} key={`s${current}`} />
        )}
        {pages > 1 && (
          <div className={s.pager} style={{ ["--page-ms" as string]: `${PAGE_MS}ms` }}>
            {Array.from({ length: pages }, (_, i) => (
              <i key={`${view}-${i}-${current}`} className={i === current ? s.on : ""} />
            ))}
          </div>
        )}
      </main>

      <footer className={s.ticker} ref={footerRef}>
        <span className={s.dot} />
        {round?.live ? (
          finished === 0 ? (
            <span>
              หาชื่อตัวเองแล้วไปที่ <b>โต๊ะตามเลข</b> · แข่งเสร็จ <b>สแกน QR ที่โต๊ะ</b> ส่งผลทั้งสองฝ่าย
            </span>
          ) : (
            <span>
              แข่งเสร็จแล้ว <b>สแกน QR ที่โต๊ะ</b> ส่งผลทั้งสองฝ่าย · มีปัญหา กด <b>เรียกกรรมการ</b> ที่หน้าโต๊ะ
            </span>
          )
        ) : data.tournamentDone ? (
          <span>ขอบคุณผู้เข้าแข่งขันทุกคน</span>
        ) : (
          <span>
            เรียงตาม <b>แต้ม</b> แล้วตาม <b>ผลต่าง</b> · Round {(round?.number ?? 0) + 1} จะขึ้นเมื่อกรรมการยืนยันคู่
          </span>
        )}
        <div className={s.controls}>
          <div className={s.modes} role="group" aria-label="เลือกสิ่งที่แสดงบนจอ">
            {MODES.map((m) => (
              <button
                key={m.mode}
                type="button"
                aria-pressed={mode === m.mode}
                className={mode === m.mode ? s.modeOn : ""}
                onClick={() => setMode(m.mode)}
              >
                {m.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className={s.fsButton}
            onClick={async () => {
              try {
                if (document.fullscreenElement) await document.exitFullscreen();
                else await document.documentElement.requestFullscreen();
              } catch {}
            }}
          >
            เต็มจอ
          </button>
        </div>
        <div className={s.siteQr}>
          <span>
            สแกนดูผลและอันดับ
            <b>{siteQr.url.replace(/^https?:\/\//, "").replace(/\/$/, "")}</b>
          </span>
          {/* eslint-disable-next-line @next/next/no-img-element -- data: URI, next/image can't optimize it anyway */}
          <img src={siteQr.dataUrl} alt={`QR code for ${siteQr.url}`} />
        </div>
      </footer>
    </div>
  );
}

function TableTile({
  t,
  showResult,
  markPlaying,
}: {
  t: HallTable;
  showResult: boolean;
  // "กำลังแข่ง" only helps once some tables have finished — before that it's on every tile.
  markPlaying: boolean;
}) {
  const result = showResult && t.state === "done" && t.scoreA != null && t.scoreB != null;
  const side = (mine: number | null, theirs: number | null) =>
    !result ? "" : mine === theirs ? s.tie : (mine ?? 0) > (theirs ?? 0) ? s.win : s.loss;
  const stateClass = !showResult ? "" : t.state === "done" ? s.done : t.state === "conflict" ? `${s.conflict} ${s.playing}` : t.state === "playing" ? s.playing : "";
  return (
    <div className={`${s.tile} ${stateClass}`}>
      <div className={`${s.num} ${t.state === "bye" ? s.byeNum : ""}`}>
        {t.state === "bye" ? (
          <b>Bye</b>
        ) : (
          <>
            <small>โต๊ะ</small>
            <b>{t.table ?? "–"}</b>
          </>
        )}
      </div>
      <div className={s.names}>
        <div className={`${s.p} ${side(t.scoreA, t.scoreB)}`}>
          <span className={s.n}>{t.a.name}</span>
          <span className={s.no}>#{t.a.no}</span>
          {result && <span className={s.s}>{t.scoreA}</span>}
        </div>
        {t.b && (
          <>
            <div className={s.vsline}>VS</div>
            <div className={`${s.p} ${side(t.scoreB, t.scoreA)}`}>
              <span className={s.n}>{t.b.name}</span>
              <span className={s.no}>#{t.b.no}</span>
              {result && <span className={s.s}>{t.scoreB}</span>}
            </div>
          </>
        )}
      </div>
      {showResult && t.state === "conflict" && <span className={s.tag}>รอกรรมการตรวจผล</span>}
      {showResult && markPlaying && t.state === "playing" && (
        <span className={`${s.tag} ${s.tagQuiet}`}>กำลังแข่ง</span>
      )}
    </div>
  );
}

function StandingsBoard({ rows, twoCols }: { rows: HallStanding[]; twoCols: boolean }) {
  const half = Math.ceil(rows.length / 2);
  const columns = twoCols && rows.length > 6 ? [rows.slice(0, half), rows.slice(half)] : [rows];
  return (
    <div className={s.board}>
      {columns.map((col, i) => (
        <div key={i}>
          <div className={s.headRow}>
            <span>#</span>
            <span>ผู้เล่น</span>
            <span>แต้ม</span>
            <span>W-T-L</span>
            <span>ผลต่าง</span>
          </div>
          <ol>
            {col.map((r) => (
              <li key={`${r.group}-${r.rank}-${r.name}`} className={`${s.row} ${r.rank <= 3 ? s.top3 : ""}`}>
                <span className={s.rk}>{r.rank}</span>
                <span className={s.who}>
                  {r.name}
                  {r.nickname && <small>{r.nickname}</small>}
                  {r.group && <small>{r.group}</small>}
                </span>
                <span className={s.pts}>{r.points}</span>
                <span className={s.wtl}>
                  {r.wins}-{r.ties}-{r.losses}
                </span>
                <span className={`${s.diff} ${r.diff >= 0 ? s.pos : s.neg}`}>
                  {r.diff >= 0 ? "+" : ""}
                  {r.diff}
                </span>
              </li>
            ))}
          </ol>
        </div>
      ))}
    </div>
  );
}
