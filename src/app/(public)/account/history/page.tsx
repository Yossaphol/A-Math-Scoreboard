import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";

const RESULT_LABEL: Record<string, string> = { WIN: "ชนะ", TIE: "เสมอ", LOSS: "แพ้" };

export default async function AccountHistoryPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login?callbackUrl=/account/history");

  const globalPlayer = await prisma.globalPlayer.findUnique({
    where: { userId: session.user.id },
  });
  if (!globalPlayer) redirect("/account");

  const tournamentPlayers = await prisma.tournamentPlayer.findMany({
    where: { globalPlayerId: globalPlayer.id },
    include: {
      tournament: true,
      matchesAsPlayer1: {
        where: { status: { in: ["CONFIRMED", "BYE"] } },
        include: { player2: { include: { globalPlayer: true } }, round: true },
      },
      matchesAsPlayer2: {
        where: { status: { in: ["CONFIRMED", "BYE"] } },
        include: { player1: { include: { globalPlayer: true } }, round: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <PageHeader title="ประวัติการแข่งขัน" subtitle={globalPlayer.name} />

      {tournamentPlayers.length === 0 && (
        <EmptyState title="ยังไม่มีประวัติการแข่งขัน" />
      )}

      <div className="space-y-6">
        {tournamentPlayers.map((tp) => {
          const matches = [
            ...tp.matchesAsPlayer1.map((m) => ({
              roundNumber: m.round.roundNumber,
              opponent: m.player2?.globalPlayer.name ?? "Bye",
              myScore: m.finalPlayer1Score,
              oppScore: m.finalPlayer2Score,
              result: m.player1Result,
              isBye: m.isBye,
            })),
            ...tp.matchesAsPlayer2.map((m) => ({
              roundNumber: m.round.roundNumber,
              opponent: m.player1.globalPlayer.name,
              myScore: m.finalPlayer2Score,
              oppScore: m.finalPlayer1Score,
              result: m.player2Result,
              isBye: false,
            })),
          ].sort((a, b) => a.roundNumber - b.roundNumber);

          return (
            <Card key={tp.id}>
              <div className="flex items-center justify-between">
                <Link href={`/t/${tp.tournamentId}`} className="font-medium hover:underline">
                  {tp.tournament.name}
                </Link>
                <span className="text-xs text-neutral-500">#{tp.tournamentPlayerNo}</span>
              </div>

              <ul className="mt-3 divide-y divide-neutral-100">
                {matches.map((m, i) => (
                  <li key={i} className="flex items-center justify-between py-2 text-sm">
                    <span className="text-neutral-500">R{m.roundNumber}</span>
                    <span>{m.isBye ? "Bye" : `vs ${m.opponent}`}</span>
                    <span className="font-medium">
                      {m.isBye ? "—" : `${m.myScore} - ${m.oppScore}`}{" "}
                      {m.result && <span className="text-neutral-500">({RESULT_LABEL[m.result]})</span>}
                    </span>
                  </li>
                ))}
                {matches.length === 0 && (
                  <li className="py-2 text-center text-xs text-neutral-500">ยังไม่มีผลการแข่งขัน</li>
                )}
              </ul>
            </Card>
          );
        })}
      </div>
    </main>
  );
}
