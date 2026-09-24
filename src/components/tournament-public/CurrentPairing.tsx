import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { inputClass } from "@/components/ui/styles";
import { MATCH_STATUS_BADGE, ROUND_STATUS_BADGE } from "@/lib/status-labels";

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
          },
          orderBy: { tableId: "asc" },
        },
      },
    }),
  ]);
  const totalRounds = tournament?.setNumberOfGames ? tournament.numberOfGames : null;
  const roundStatus = currentRound ? ROUND_STATUS_BADGE[currentRound.status] : null;

  return (
    <div>
      <form className="mb-6">
        <input
          type="search"
          placeholder="ค้นหาผู้เล่นด้วยชื่อ, Nickname หรือ Player ID..."
          className={inputClass}
        />
      </form>

      {/* Always say which Round is on screen — otherwise a finished Round reads as the live one. */}
      {currentRound && roundStatus && (
        <Card padding="p-4" className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs text-neutral-500">กำลังแสดงการจับคู่ของ</p>
            <p className="text-xl font-semibold text-neutral-900">
              Round {currentRound.roundNumber}
              {totalRounds != null && (
                <span className="ml-1 text-sm font-normal text-neutral-400">/ {totalRounds}</span>
              )}
            </p>
            {currentRound.status === "COMPLETED" && (
              <p className="mt-0.5 text-xs text-neutral-500">
                Round นี้จบแล้ว — รอ Admin/Staff จับคู่ Round ถัดไป
              </p>
            )}
          </div>
          <Badge variant={roundStatus.variant} className="shrink-0">
            {roundStatus.label}
          </Badge>
        </Card>
      )}

      {!currentRound && <EmptyState title="ยังไม่มี Round ใน Tournament นี้" />}

      {currentRound && currentRound.matches.length === 0 && (
        <EmptyState
          title={`Round ${currentRound.roundNumber} ยังไม่มีการจับคู่`}
          description="รอ Admin/Staff Generate Pairing"
        />
      )}

      <ul className="space-y-3">
        {currentRound?.matches.map((m) => {
          const status = MATCH_STATUS_BADGE[m.status];
          return (
            <li key={m.id}>
              <Card padding="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-neutral-900">
                      [{m.player1.tournamentPlayerNo}] {m.player1.globalPlayer.name}
                    </p>
                    {m.firstPlayerId === m.player1Id && <Badge variant="accent">FIRST</Badge>}
                  </div>
                  <span className="text-xs text-neutral-400">VS</span>
                  <div className="text-right">
                    {m.player2 ? (
                      <>
                        <p className="font-medium text-neutral-900">
                          [{m.player2.tournamentPlayerNo}] {m.player2.globalPlayer.name}
                        </p>
                        {m.firstPlayerId === m.player2Id && <Badge variant="accent">FIRST</Badge>}
                      </>
                    ) : (
                      <p className="font-medium text-neutral-500">BYE</p>
                    )}
                  </div>
                </div>
                {!m.isBye && (
                  <div className="mt-3 flex justify-center">
                    {m.status === "CONFIRMED" ? (
                      <span className="text-sm font-medium text-neutral-900">
                        {m.finalPlayer1Score} - {m.finalPlayer2Score}
                      </span>
                    ) : (
                      <Badge variant={status.variant}>{status.label}</Badge>
                    )}
                  </div>
                )}
              </Card>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
