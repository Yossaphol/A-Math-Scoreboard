import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getScoreboardView } from "@/lib/scoreboard";
import { hasPracticeAccess } from "@/lib/practice-lock";
import { AutoRefresh } from "@/components/ui/AutoRefresh";
import { HallScreen, type HallTable } from "@/components/screen/HallScreen";

export const metadata: Metadata = { title: "จอห้องแข่ง · Score A-Math" };

/**
 * The hall's big screen (TV/projector): who plays at which table, live results, standings.
 * Shows only what the public tournament pages already show, so it needs no login — except a
 * PIN-locked practice tournament, which stays behind its PIN like its public pages.
 */
export default async function HallScreenPage(props: PageProps<"/screen/[id]">) {
  const { id } = await props.params;
  const tournament = await prisma.tournament.findUnique({
    where: { id },
    select: { id: true, name: true, mode: true, pinCode: true, status: true },
  });
  if (!tournament) notFound();

  if (!(await hasPracticeAccess(tournament))) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4 text-center text-neutral-600">
        <p>
          Tournament นี้ล็อกด้วยรหัสผ่าน ·{" "}
          <Link href={`/practice/${tournament.id}`} className="font-medium text-neutral-900 underline">
            ใส่รหัสก่อน
          </Link>{" "}
          แล้วเปิดหน้านี้อีกครั้ง
        </p>
      </main>
    );
  }

  const [round, scoreboard] = await Promise.all([
    prisma.round.findFirst({
      where: { tournamentId: id, status: { in: ["CONFIRMED", "COMPLETED"] } },
      orderBy: { roundNumber: "desc" },
      include: {
        matches: {
          include: {
            table: { select: { tableNumber: true } },
            player1: { include: { globalPlayer: { select: { name: true } } } },
            player2: { include: { globalPlayer: { select: { name: true } } } },
          },
        },
      },
    }),
    getScoreboardView(id),
  ]);

  const tables: HallTable[] = (round?.matches ?? [])
    .map((m) => ({
      id: m.id,
      table: m.table?.tableNumber ?? null,
      a: { name: m.player1.globalPlayer.name, no: m.player1.tournamentPlayerNo },
      b: m.player2 ? { name: m.player2.globalPlayer.name, no: m.player2.tournamentPlayerNo } : null,
      state: (m.isBye || !m.player2
        ? "bye"
        : m.status === "CONFIRMED"
          ? "done"
          : m.status === "CONFLICT"
            ? "conflict"
            : "playing") as HallTable["state"],
      scoreA: m.finalPlayer1Score,
      scoreB: m.finalPlayer2Score,
    }))
    .sort((x, y) => (x.table ?? Infinity) - (y.table ?? Infinity));

  return (
    <>
      <AutoRefresh intervalMs={10_000} />
      <HallScreen
        data={{
          tournamentName: tournament.name,
          tournamentDone: tournament.status === "COMPLETED",
          round: round ? { number: round.roundNumber, live: round.status === "CONFIRMED" } : null,
          tables,
          // Split by group: each group's table in turn, ranked within the group.
          standings: scoreboard.sections
            .flatMap((section) => section.rows)
            .filter((r) => r.status === "ACTIVE")
            .map((r) => ({
              rank: r.rank,
              group: scoreboard.split ? (r.groupName ?? "ไม่มีกลุ่ม") : null,
              name: r.name,
              nickname: r.nickname,
              points: r.points,
              wins: r.wins,
              ties: r.ties,
              losses: r.losses,
              diff: r.cumulativeDiff,
            })),
        }}
      />
    </>
  );
}
