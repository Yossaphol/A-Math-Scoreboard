import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { inputClass } from "@/components/ui/styles";
import { MATCH_STATUS_BADGE } from "@/lib/status-labels";

/** Shared body of the /t/[id] and /practice/[id] "current pairing" tab. */
export async function CurrentPairing({ tournamentId }: { tournamentId: string }) {
  // Only ever show a Confirmed/Completed round publicly — a Preview is not real yet (spec §9/§10).
  const currentRound = await prisma.round.findFirst({
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
  });

  return (
    <div>
      <form className="mb-6">
        <input
          type="search"
          placeholder="ค้นหาผู้เล่นด้วยชื่อ, Nickname หรือ Player ID..."
          className={inputClass}
        />
      </form>

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
