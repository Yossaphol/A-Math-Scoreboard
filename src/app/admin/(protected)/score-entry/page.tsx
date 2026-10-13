import Link from "next/link";
import { requireStaffOrAdmin } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { AutoRefresh } from "@/components/ui/AutoRefresh";
import { LinkButton } from "@/components/ui/Button";
import { AdminMatchCard, adminMatchSearchKey, needsAttention } from "@/components/match/AdminMatchCard";
import { MatchSearchList } from "@/components/match/MatchSearchList";
import { roundLimitOf } from "@/lib/tournament-limits";

type Phase = "live" | "round-done" | "tournament-done";

/**
 * "กรอกผล": one click from the sidebar to the round in play, with a search box over its
 * tables — instead of Tournaments → tournament → Rounds → round → scroll. Opens the round
 * that's in progress in a tournament this person runs (Staff: only their assignments).
 * ?t= picks the tournament when several are running; ?m= opens straight on one match (the
 * referee-call popup links here).
 */
// A tournament that finished this recently still opens here (with its "จบแล้ว" card), so the
// last result entered isn't followed by a blank page; after that it drops off the list.
const FINISHED_VISIBLE_MS = 12 * 60 * 60 * 1000;

function finishedCutoff() {
  return new Date(Date.now() - FINISHED_VISIBLE_MS);
}

export default async function ScoreEntryPage(props: PageProps<"/admin/score-entry">) {
  const user = await requireStaffOrAdmin();
  const { t, m } = await props.searchParams;

  const tournaments = await prisma.tournament.findMany({
    where: {
      ...(user.role === "ADMIN" ? {} : { staff: { some: { userId: user.id, status: "ACTIVE" } } }),
      OR: [
        { status: "ONGOING" },
        { status: "COMPLETED", updatedAt: { gt: finishedCutoff() } },
      ],
      rounds: { some: { status: { in: ["CONFIRMED", "COMPLETED"] } } },
    },
    select: {
      id: true,
      name: true,
      status: true,
      setNumberOfGames: true,
      numberOfGames: true,
      rounds: {
        where: { status: { in: ["PREVIEW", "CONFIRMED", "COMPLETED"] } },
        orderBy: { roundNumber: "desc" },
        take: 2,
        select: { id: true, roundNumber: true, status: true, confirmedAt: true },
      },
    },
  });

  // Per tournament: the round to show (the one in play, else the last one played) and, when
  // it's done, what comes next.
  const candidates = tournaments
    .map((tour) => {
      const shown = tour.rounds.find((r) => r.status === "CONFIRMED" || r.status === "COMPLETED")!;
      const preview = tour.rounds.find((r) => r.status === "PREVIEW" && r.roundNumber > shown.roundNumber);
      const phase: Phase =
        shown.status === "CONFIRMED" ? "live" : tour.status === "COMPLETED" ? "tournament-done" : "round-done";
      return { tour, shown, preview, phase };
    })
    .sort(
      (a, b) =>
        Number(b.phase === "live") - Number(a.phase === "live") ||
        (b.shown.confirmedAt?.getTime() ?? 0) - (a.shown.confirmedAt?.getTime() ?? 0)
    );

  if (candidates.length === 0) {
    return (
      <div>
        <PageHeader title="กรอกผล" />
        <Card className="text-center">
          <p className="text-sm font-medium text-neutral-900">ยังไม่มี Round ที่กำลังแข่งขัน</p>
          <p className="mt-1 text-xs text-neutral-500">
            Confirm Pairing ของ Round ใน Tournament ก่อน แล้วหน้านี้จะเปิด Round นั้นให้เอง
          </p>
          <LinkButton href="/admin/tournaments" variant="secondary" size="sm" className="mt-4">
            ไปที่ Tournaments
          </LinkButton>
        </Card>
      </div>
    );
  }

  const selected = candidates.find((c) => c.tour.id === t) ?? candidates[0];
  const round = await prisma.round.findUniqueOrThrow({
    where: { id: selected.shown.id },
    include: {
      matches: {
        include: {
          table: true,
          player1: { include: { globalPlayer: true } },
          player2: { include: { globalPlayer: true } },
          submissions: true,
        },
      },
    },
  });

  const byTable = (a: (typeof round.matches)[number], b: (typeof round.matches)[number]) =>
    (a.table?.tableNumber ?? Infinity) - (b.table?.tableNumber ?? Infinity);
  const isDone = (x: (typeof round.matches)[number]) => x.status === "CONFIRMED" || x.status === "BYE";
  // Work queue: what needs Admin/Staff first, then half-reported, then not started.
  const priority = (x: (typeof round.matches)[number]) =>
    needsAttention(x) ? 0 : x.status === "SUBMITTED" ? 1 : 2;
  const sorted = [...round.matches].sort(byTable);
  const open = sorted.filter((x) => !isDone(x)).sort((a, b) => priority(a) - priority(b));
  const done = sorted.filter(isDone);
  const toRow = (x: (typeof round.matches)[number]) => ({
    id: x.id,
    key: adminMatchSearchKey(x),
    node: <AdminMatchCard key={x.id} match={x} roundNumber={round.roundNumber} />,
  });

  // Opened from a referee call: start with that match's table in the search box.
  const focused = typeof m === "string" ? round.matches.find((x) => x.id === m) : undefined;
  const initialQuery = focused?.table ? String(focused.table.tableNumber) : "";
  const percent = round.matches.length ? Math.round((done.length / round.matches.length) * 100) : 0;

  return (
    <div>
      {/* Also how a finished round hands over: once the next one is confirmed, it shows up here. */}
      <AutoRefresh intervalMs={8000} />
      <PageHeader
        title={`กรอกผล · Round ${round.roundNumber}`}
        subtitle={selected.tour.name}
        actions={
          <Link
            href={`/admin/tournaments/${selected.tour.id}/rounds/${round.id}`}
            className="text-xs text-neutral-500 hover:text-neutral-900"
          >
            เปิดหน้า Round เต็ม →
          </Link>
        }
      />

      {candidates.length > 1 && (
        <div className="-mt-3 mb-5 flex flex-wrap gap-2" role="tablist" aria-label="Tournament">
          {candidates.map((c) => {
            const active = c.tour.id === selected.tour.id;
            return (
              <Link
                key={c.tour.id}
                href={`/admin/score-entry?t=${c.tour.id}`}
                role="tab"
                aria-selected={active}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors ${
                  active
                    ? "border-neutral-900 bg-neutral-900 font-medium text-white"
                    : "border-neutral-200 bg-white/70 text-neutral-600 hover:border-neutral-300"
                }`}
              >
                {c.phase === "live" ? (
                  <span className="size-1.5 rounded-full bg-success" aria-label="กำลังแข่ง" />
                ) : (
                  <span aria-label="จบแล้ว">✓</span>
                )}
                {c.tour.name} · R{c.shown.roundNumber}
              </Link>
            );
          })}
        </div>
      )}

      <div className="mb-5 flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-neutral-200/80">
          <div className="h-full rounded-full bg-success transition-all" style={{ width: `${percent}%` }} />
        </div>
        <span
          className={`shrink-0 text-xs font-medium tabular-nums ${selected.phase === "live" ? "text-neutral-700" : "text-success"}`}
        >
          {selected.phase === "live" ? "ยืนยันแล้ว" : "✓ ครบ"} {done.length}/{round.matches.length} แมตช์
        </span>
      </div>

      {selected.phase !== "live" && (
        <FinishedBanner
          phase={selected.phase}
          tournamentId={selected.tour.id}
          roundNumber={round.roundNumber}
          roundLimit={roundLimitOf(selected.tour)}
          preview={selected.preview ?? null}
          matchCount={round.matches.length}
          tieCount={round.matches.filter((x) => x.status === "CONFIRMED" && x.player1Result === "TIE").length}
        />
      )}

      <MatchSearchList
        key={round.id}
        open={open.map(toRow)}
        done={done.map(toRow)}
        initialQuery={initialQuery}
        autoFocus
        focusShortcut
      />
      <p className="mt-2 text-[11px] text-neutral-400">
        คีย์ลัด: <kbd className="rounded border border-neutral-200 bg-white px-1">/</kbd> ค้นหา ·{" "}
        <kbd className="rounded border border-neutral-200 bg-white px-1">Enter</kbd> ไปช่องคะแนน ·{" "}
        <kbd className="rounded border border-neutral-200 bg-white px-1">Tab</kbd> ช่องถัดไป ·{" "}
        <kbd className="rounded border border-neutral-200 bg-white px-1">Enter</kbd> บันทึก
      </p>
    </div>
  );
}

function DoneIcon({ phase }: { phase: Phase }) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className: "size-[22px]",
    "aria-hidden": true,
  };
  return phase === "tournament-done" ? (
    <svg {...common}>
      <path d="M8 4h8v5a4 4 0 01-8 0V4z" />
      <path d="M16 6h3v1.5A3.5 3.5 0 0115.7 11M8 6H5v1.5A3.5 3.5 0 008.3 11M12 13v4M8.5 20h7M10 17h4" />
    </svg>
  ) : (
    <svg {...common}>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.5l2.7 2.7L16 9.8" />
    </svg>
  );
}

// Shown in place of a blank page once the round on screen is finished: what happened, and the
// one next step (open / confirm the next round, or see the final standings).
function FinishedBanner({
  phase,
  tournamentId,
  roundNumber,
  roundLimit,
  preview,
  matchCount,
  tieCount,
}: {
  phase: Exclude<Phase, "live">;
  tournamentId: string;
  roundNumber: number;
  roundLimit: number | null;
  preview: { id: string; roundNumber: number } | null;
  matchCount: number;
  tieCount: number;
}) {
  const next = roundNumber + 1;
  const scoreboard = `/admin/tournaments/${tournamentId}`;
  return (
    <section
      className="mb-5 grid grid-cols-[auto_minmax(0,1fr)] gap-4 rounded-2xl border border-success/30 bg-white p-5 shadow-[0_12px_32px_-12px_rgba(16,24,40,0.14)] max-sm:grid-cols-1"
      style={{ backgroundImage: "radial-gradient(circle at 0 0, rgba(16,185,129,0.12), transparent 60%)" }}
    >
      <span className="flex size-11 items-center justify-center rounded-xl border border-neutral-200/80 bg-white text-success">
        <DoneIcon phase={phase} />
      </span>
      <div className="min-w-0">
        {phase === "tournament-done" ? (
          <>
            <h2 className="text-base font-semibold text-neutral-900">การแข่งขันจบแล้ว</h2>
            <p className="mt-0.5 text-sm text-neutral-500">
              {/* Ended early by hand (status set in Settings) — don't claim the limit was reached. */}
              {roundLimit && roundNumber >= roundLimit
                ? `ครบ ${roundLimit} รอบตามที่กำหนดไว้`
                : `จบที่ Round ${roundNumber}`}{" "}
              · Tournament
              เปลี่ยนสถานะเป็น &quot;จบแล้ว&quot;
            </p>
          </>
        ) : (
          <>
            <h2 className="text-base font-semibold text-neutral-900">Round {roundNumber} จบแล้ว</h2>
            <p className="mt-0.5 text-sm text-neutral-500">
              ยืนยันผลครบทุกโต๊ะ · ขั้นต่อไป: {preview ? `ตรวจและ Confirm Round ${preview.roundNumber}` : `เปิด Round ${next}`}
            </p>
          </>
        )}
        <p className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-500">
          <span>
            แมตช์ <b className="tabular-nums text-neutral-900">{matchCount}</b>
          </span>
          <span>
            เสมอ <b className="tabular-nums text-neutral-900">{tieCount}</b>
          </span>
          {phase === "round-done" && roundLimit && (
            <span>
              เหลืออีก <b className="tabular-nums text-neutral-900">{Math.max(0, roundLimit - roundNumber)}</b> รอบ
              (กำหนดไว้ {roundLimit} รอบ)
            </span>
          )}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {phase === "tournament-done" ? (
            <>
              <LinkButton href={scoreboard}>ดูอันดับสุดท้าย (Scoreboard)</LinkButton>
              <LinkButton href="/admin/tournaments" variant="secondary">
                ไปที่ Tournaments
              </LinkButton>
            </>
          ) : (
            <>
              {preview ? (
                <LinkButton href={`/admin/tournaments/${tournamentId}/rounds/${preview.id}`}>
                  ตรวจและ Confirm Round {preview.roundNumber}
                </LinkButton>
              ) : (
                <LinkButton href={scoreboard}>+ เปิด Round {next}</LinkButton>
              )}
              <LinkButton href={scoreboard} variant="secondary">
                ดู Scoreboard
              </LinkButton>
            </>
          )}
        </div>
        {phase === "round-done" && (
          <p className="mt-3 flex items-center gap-2 text-xs text-neutral-500">
            <span className="size-1.5 animate-pulse rounded-full bg-success" aria-hidden="true" />
            พอ Confirm Pairing ของ Round {preview?.roundNumber ?? next} แล้ว หน้านี้จะสลับไป Round ใหม่ให้เอง
          </p>
        )}
        <p className="mt-1 text-xs text-neutral-400">ยังแก้ผลของ Round นี้ได้: ค้นหาโต๊ะด้านล่างแล้วกด &quot;แก้ไขผล&quot;</p>
      </div>
    </section>
  );
}
