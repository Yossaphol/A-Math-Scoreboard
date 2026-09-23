import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { cappedDiff } from "@/lib/match/diff";
import { BYE_SCORE } from "@/lib/match/bye";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { MATCH_STATUS_BADGE, MATCH_OUTCOME_BADGE } from "@/lib/status-labels";

/** Shared body of the /t/[id]/rounds/[roundId] and /practice/[id]/rounds/[roundId] pages. */
export async function RoundDetail({ tournamentId, roundId }: { tournamentId: string; roundId: string }) {
  const round = await prisma.round.findUnique({
    where: { id: roundId },
    include: {
      matches: {
        include: {
          player1: { include: { globalPlayer: true } },
          player2: { include: { globalPlayer: true } },
        },
      },
      absences: { include: { tournamentPlayer: { include: { globalPlayer: true } } } },
    },
  });
  if (!round || round.tournamentId !== tournamentId || !["CONFIRMED", "COMPLETED"].includes(round.status)) {
    notFound();
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xs font-medium text-neutral-500">Round {round.roundNumber}</h2>
        {round.maximumScoreEnabled && round.maximumScore != null && (
          <span className="text-xs text-neutral-400">Max Diff Cap ±{round.maximumScore}</span>
        )}
      </div>

      <ul className="space-y-3">
        {round.matches.map((m) => {
          const status = MATCH_STATUS_BADGE[m.status];

          if (m.isBye || !m.player2) {
            return (
              <li key={m.id}>
                <Card padding="p-4" className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    {m.player1.globalPlayer.name}
                    <span className="ml-1.5 text-xs font-normal text-neutral-400">
                      (#{m.player1.tournamentPlayerNo})
                    </span>
                  </span>
                  <Badge variant="neutral">Bye</Badge>
                </Card>
              </li>
            );
          }

          const confirmed = m.status === "CONFIRMED" && m.finalPlayer1Score != null && m.finalPlayer2Score != null;
          const rawDiff = confirmed ? m.finalPlayer1Score! - m.finalPlayer2Score! : 0;
          const diff = confirmed
            ? cappedDiff(m.finalPlayer1Score!, m.finalPlayer2Score!, round.maximumScoreEnabled, round.maximumScore)
            : null;
          const wasCapped = diff != null && diff !== rawDiff;

          return (
            <li key={m.id}>
              <Card padding="p-4">
                <div className="flex items-center justify-between gap-3">
                  <PlayerResult
                    name={m.player1.globalPlayer.name}
                    tournamentPlayerNo={m.player1.tournamentPlayerNo}
                    score={confirmed ? m.finalPlayer1Score : null}
                    result={confirmed ? m.player1Result : null}
                    align="left"
                  />
                  <span className="shrink-0 text-xs text-neutral-300">VS</span>
                  <PlayerResult
                    name={m.player2.globalPlayer.name}
                    tournamentPlayerNo={m.player2.tournamentPlayerNo}
                    score={confirmed ? m.finalPlayer2Score : null}
                    result={confirmed ? m.player2Result : null}
                    align="right"
                  />
                </div>

                {confirmed ? (
                  <p className="mt-3 border-t border-neutral-100 pt-2.5 text-center text-xs text-neutral-500">
                    ผลต่าง{" "}
                    <span className="font-medium text-neutral-900">
                      {diff! > 0 ? `+${diff}` : diff}
                    </span>
                    {wasCapped && (
                      <span className="ml-1 text-neutral-400">
                        (คะแนนจริงต่างกัน {rawDiff > 0 ? `+${rawDiff}` : rawDiff} แต่ถูกจำกัดไว้ที่ ±
                        {round.maximumScore})
                      </span>
                    )}
                  </p>
                ) : (
                  <div className="mt-3 flex justify-center border-t border-neutral-100 pt-2.5">
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </div>
                )}
              </Card>
            </li>
          );
        })}
      </ul>

      {round.absences.length > 0 && (
        <Card padding="p-4" className="mt-3">
          <p className="text-xs font-medium text-neutral-500">ไม่มาแข่ง — แพ้ 0-{BYE_SCORE} (-{BYE_SCORE})</p>
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {round.absences
              .map((a) => a.tournamentPlayer)
              .sort((a, b) => a.tournamentPlayerNo - b.tournamentPlayerNo)
              .map((p) => (
                <li key={p.id}>
                  {p.globalPlayer.name}
                  <span className="ml-1.5 text-xs text-neutral-400">(#{p.tournamentPlayerNo})</span>
                </li>
              ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function PlayerResult({
  name,
  tournamentPlayerNo,
  score,
  result,
  align,
}: {
  name: string;
  tournamentPlayerNo: number;
  score: number | null;
  result: "WIN" | "TIE" | "LOSS" | null;
  align: "left" | "right";
}) {
  const badge = result ? MATCH_OUTCOME_BADGE[result] : null;
  return (
    <div className={`min-w-0 flex-1 ${align === "right" ? "text-right" : "text-left"}`}>
      <p className="truncate text-sm font-medium text-neutral-900">
        {name}
        <span className="ml-1.5 text-xs font-normal text-neutral-400">(#{tournamentPlayerNo})</span>
      </p>
      <div className={`mt-1 flex items-center gap-1.5 ${align === "right" ? "justify-end" : ""}`}>
        {score != null && <span className="text-lg font-semibold text-neutral-900">{score}</span>}
        {badge && <Badge variant={badge.variant}>{badge.label}</Badge>}
      </div>
    </div>
  );
}
