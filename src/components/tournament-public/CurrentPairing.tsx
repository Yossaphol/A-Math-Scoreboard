import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { inputClass } from "@/components/ui/styles";
import { MATCH_STATUS_BADGE, ROUND_STATUS_BADGE } from "@/lib/status-labels";

// Table No · Player 1 · Result · Player 2 — shared by the column labels and every row so they line up.
const ROW_GRID = "grid grid-cols-[2rem_minmax(0,1fr)_5.5rem_minmax(0,1fr)] items-center gap-3 px-4 sm:px-5";

/** Shared body of the /t/[id] and /practice/[id] "current pairing" tab. */
export async function CurrentPairing({ tournamentId }: { tournamentId: string }) {
  // Only ever show a Confirmed/Completed round publicly — a Preview is not real yet (spec §9/§10).
  const [tournament, currentRound] = await Promise.all([
    prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: { setNumberOfGames: true, numberOfGames: true },
    }),
    prisma.round.findFirst({
      where: { tournamentId, status: { in: ["CONFIRMED", "COMPLETED"] } },
      orderBy: { roundNumber: "desc" },
      include: {
        matches: {
          include: {
            player1: { include: { globalPlayer: true } },
            player2: { include: { globalPlayer: true } },
            table: { select: { tableNumber: true } },
          },
          orderBy: { table: { tableNumber: "asc" } },
        },
      },
    }),
  ]);

  const search = (
    <form className="mb-6">
      <input
        type="search"
        placeholder="ค้นหาผู้เล่นด้วยชื่อ, Nickname หรือ Player ID..."
        className={inputClass}
      />
    </form>
  );

  if (!currentRound) {
    return (
      <div>
        {search}
        <EmptyState title="ยังไม่มี Round ใน Tournament นี้" />
      </div>
    );
  }

  const totalRounds = tournament?.setNumberOfGames ? tournament.numberOfGames : null;
  const roundStatus = ROUND_STATUS_BADGE[currentRound.status];
  const isLive = currentRound.status === "CONFIRMED";
  const playable = currentRound.matches.filter((m) => !m.isBye);
  const scored = playable.filter((m) => m.status === "CONFIRMED").length;
  const byes = currentRound.matches.length - playable.length;

  return (
    <div>
      {search}

      <Card padding="p-0" className="overflow-hidden">
        {/* Always say which Round is on screen — otherwise a finished Round reads as the live one. */}
        <header className="bg-neutral-900 px-4 py-4 text-white sm:px-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs text-neutral-400">กำลังแสดงการจับคู่ของ</p>
              <p className="mt-0.5 text-2xl font-semibold tracking-tight">
                Round {currentRound.roundNumber}
                {totalRounds != null && (
                  <span className="ml-1.5 text-base font-normal text-neutral-500">/ {totalRounds}</span>
                )}
              </p>
            </div>
            <span
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${
                isLive ? "bg-emerald-400/15 text-emerald-300" : "bg-white/10 text-neutral-300"
              }`}
            >
              {isLive && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />}
              {roundStatus.label}
            </span>
          </div>

          <p className="mt-3 text-xs text-neutral-400">
            {isLive
              ? `ยืนยันผลแล้ว ${scored}/${playable.length} คู่`
              : "Round นี้จบแล้ว — รอ Admin/Staff จับคู่ Round ถัดไป"}
            {byes > 0 && ` · Bye ${byes}`}
          </p>
          {isLive && playable.length > 0 && (
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-emerald-400 transition-[width]"
                style={{ width: `${(scored / playable.length) * 100}%` }}
              />
            </div>
          )}
        </header>

        {currentRound.matches.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <p className="text-sm font-medium text-neutral-700">
              Round {currentRound.roundNumber} ยังไม่มีการจับคู่
            </p>
            <p className="mt-1 text-xs text-neutral-500">รอ Admin/Staff Generate Pairing</p>
          </div>
        ) : (
          <>
            <div
              className={`${ROW_GRID} border-b border-neutral-200/70 py-2 text-[11px] font-medium text-neutral-400`}
            >
              <span className="text-center">โต๊ะ</span>
              <span>ผู้เล่น</span>
              <span className="text-center">ผล</span>
              <span className="text-right">ผู้เล่น</span>
            </div>

            <ul className="divide-y divide-neutral-200/60">
              {currentRound.matches.map((m) => {
                const confirmed =
                  m.status === "CONFIRMED" && m.finalPlayer1Score != null && m.finalPlayer2Score != null;
                const p1Lost = confirmed && m.player1Result === "LOSS";
                const p2Lost = confirmed && m.player2Result === "LOSS";

                return (
                  <li key={m.id} className={`${ROW_GRID} py-3`}>
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-100 text-xs font-semibold tabular-nums text-neutral-600">
                      {m.table?.tableNumber ?? "–"}
                    </span>

                    <PlayerCell
                      name={m.player1.globalPlayer.name}
                      tournamentPlayerNo={m.player1.tournamentPlayerNo}
                      first={m.firstPlayerId === m.player1Id}
                      muted={p1Lost}
                    />

                    <div className="flex justify-center">
                      {m.isBye || !m.player2 ? (
                        <span className="rounded-md bg-neutral-100 px-2 py-0.5 text-[11px] font-semibold text-neutral-500">
                          BYE
                        </span>
                      ) : confirmed ? (
                        <span className="text-sm tabular-nums">
                          <span className={p1Lost ? "font-medium text-neutral-400" : "font-semibold text-neutral-900"}>
                            {m.finalPlayer1Score}
                          </span>
                          <span className="mx-1 text-neutral-300">:</span>
                          <span className={p2Lost ? "font-medium text-neutral-400" : "font-semibold text-neutral-900"}>
                            {m.finalPlayer2Score}
                          </span>
                        </span>
                      ) : (
                        <Badge variant={MATCH_STATUS_BADGE[m.status].variant}>
                          {MATCH_STATUS_BADGE[m.status].label}
                        </Badge>
                      )}
                    </div>

                    {m.player2 ? (
                      <PlayerCell
                        name={m.player2.globalPlayer.name}
                        tournamentPlayerNo={m.player2.tournamentPlayerNo}
                        first={m.firstPlayerId === m.player2Id}
                        muted={p2Lost}
                        alignRight
                      />
                    ) : (
                      <span className="text-right text-sm text-neutral-300">—</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </Card>
    </div>
  );
}

function PlayerCell({
  name,
  tournamentPlayerNo,
  first,
  muted,
  alignRight = false,
}: {
  name: string;
  tournamentPlayerNo: number;
  first: boolean;
  muted: boolean;
  alignRight?: boolean;
}) {
  return (
    <div className={`min-w-0 ${alignRight ? "text-right" : ""}`}>
      <p className={`truncate text-sm font-medium ${muted ? "text-neutral-500" : "text-neutral-900"}`} title={name}>
        {name}
      </p>
      <div className={`mt-0.5 flex items-center gap-1.5 ${alignRight ? "justify-end" : ""}`}>
        <span className="text-xs tabular-nums text-neutral-400">#{tournamentPlayerNo}</span>
        {first && (
          <span className="rounded bg-accent/10 px-1.5 text-[10px] font-semibold leading-4 text-accent">FIRST</span>
        )}
      </div>
    </div>
  );
}
