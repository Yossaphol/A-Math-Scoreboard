import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { MATCH_STATUS_BADGE } from "@/lib/status-labels";

export default async function PublicRoundDetailPage(props: PageProps<"/t/[id]/rounds/[roundId]">) {
  const { id, roundId } = await props.params;

  const round = await prisma.round.findUnique({
    where: { id: roundId },
    include: {
      matches: {
        include: {
          player1: { include: { globalPlayer: true } },
          player2: { include: { globalPlayer: true } },
        },
      },
    },
  });
  if (!round || round.tournamentId !== id || !["CONFIRMED", "COMPLETED"].includes(round.status)) {
    notFound();
  }

  return (
    <div>
      <h2 className="mb-4 text-xs font-medium text-neutral-500">Round {round.roundNumber}</h2>
      <ul className="space-y-3">
        {round.matches.map((m) => {
          const status = MATCH_STATUS_BADGE[m.status];
          return (
            <li key={m.id}>
              <Card padding="p-4" className="flex items-center justify-between">
                <span className="text-sm">
                  #{m.player1.tournamentPlayerNo} {m.player1.globalPlayer.name}
                  {m.player2
                    ? ` vs #${m.player2.tournamentPlayerNo} ${m.player2.globalPlayer.name}`
                    : " (Bye)"}
                </span>
                {m.status === "CONFIRMED" && !m.isBye ? (
                  <span className="text-sm font-medium">
                    {m.finalPlayer1Score} - {m.finalPlayer2Score}
                  </span>
                ) : (
                  <Badge variant={status.variant}>{status.label}</Badge>
                )}
              </Card>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
