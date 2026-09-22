import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { getScoreboard } from "@/lib/scoreboard";
import { requestPlayerLink } from "@/lib/actions/link-requests";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { EditOwnNameForm } from "@/components/account/EditOwnNameForm";
import { inputClass } from "@/components/ui/styles";

const REQUEST_STATUS_LABEL: Record<string, { label: string; variant: "warning" | "success" | "danger" }> = {
  PENDING: { label: "รอตรวจสอบ", variant: "warning" },
  APPROVED: { label: "อนุมัติแล้ว", variant: "success" },
  REJECTED: { label: "ถูกปฏิเสธ", variant: "danger" },
};

const RESULT_LABEL: Record<string, string> = { WIN: "ชนะ", TIE: "เสมอ", LOSS: "แพ้" };

export default async function AccountPage(props: PageProps<"/account">) {
  const session = await getSession();
  if (!session?.user) redirect("/login?callbackUrl=/account");

  const { q } = await props.searchParams;
  const query = typeof q === "string" ? q.trim() : "";

  const [globalPlayer, myRequests] = await Promise.all([
    prisma.globalPlayer.findUnique({ where: { userId: session.user.id } }),
    prisma.linkRequest.findMany({
      where: { userId: session.user.id },
      include: { globalPlayer: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const searchResults =
    !globalPlayer && query
      ? await prisma.globalPlayer.findMany({
          where: { userId: null, name: { contains: query, mode: "insensitive" } },
          take: 10,
        })
      : [];

  const tournamentPlayers = globalPlayer
    ? await prisma.tournamentPlayer.findMany({
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
      })
    : [];

  // Rank only means anything once a Tournament is actually done (spec: standings are always
  // derived from CONFIRMED matches only — mid-tournament "rank" would just churn every round).
  const rankByTournamentId = new Map<string, number>();
  await Promise.all(
    tournamentPlayers
      .filter((tp) => tp.tournament.status === "COMPLETED")
      .map(async (tp) => {
        const rows = await getScoreboard(tp.tournamentId);
        const mine = rows.find((r) => r.tournamentPlayerId === tp.id);
        if (mine) rankByTournamentId.set(tp.tournamentId, mine.rank);
      })
  );

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-xl font-semibold text-neutral-900">บัญชีของฉัน</h1>
      <p className="mt-0.5 text-sm text-neutral-500">{session.user.email}</p>

      <Card id="profile" className="mt-6 scroll-mt-20">
        {globalPlayer ? (
          <>
            <p className="text-xs text-neutral-500">Global Player</p>
            <p className="mt-1 text-lg font-semibold">{globalPlayer.name}</p>
            {globalPlayer.nickname && <p className="text-sm text-neutral-500">{globalPlayer.nickname}</p>}
            <p className="mt-2 text-xs text-neutral-400">Player ID: {globalPlayer.id}</p>
            <EditOwnNameForm name={globalPlayer.name} nickname={globalPlayer.nickname} />
          </>
        ) : (
          <>
            <p className="text-sm font-medium">ยังไม่ได้ผูกบัญชีกับผู้เล่น</p>
            <p className="mt-1 text-xs text-neutral-500">
              ค้นหาชื่อผู้เล่นของคุณแล้วส่งคำขอผูกบัญชี — Admin จะตรวจสอบก่อนอนุมัติ
            </p>
            <form className="mt-4">
              <input
                type="search"
                name="q"
                defaultValue={query}
                placeholder="ค้นหาชื่อผู้เล่น..."
                className={inputClass}
              />
            </form>

            {query && (
              <ul className="mt-4 divide-y divide-neutral-100">
                {searchResults.map((p) => (
                  <li key={p.id} className="flex items-center justify-between py-2 text-sm">
                    <span>{p.name}</span>
                    <form action={requestPlayerLink}>
                      <input type="hidden" name="globalPlayerId" value={p.id} />
                      <Button type="submit" variant="secondary" size="sm">
                        ขอผูกบัญชี
                      </Button>
                    </form>
                  </li>
                ))}
                {searchResults.length === 0 && (
                  <li className="py-4 text-center text-xs text-neutral-500">
                    ไม่พบผู้เล่นที่ตรงกับ &quot;{query}&quot;
                  </li>
                )}
              </ul>
            )}
          </>
        )}
      </Card>

      {myRequests.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-2 text-xs font-medium text-neutral-500">คำขอผูกบัญชีของฉัน</h2>
          <Card padding="p-0">
            <ul className="divide-y divide-neutral-100">
              {myRequests.map((r) => {
                const status = REQUEST_STATUS_LABEL[r.status];
                return (
                  <li key={r.id} className="flex items-center justify-between px-4 py-3 text-sm">
                    <span>{r.globalPlayer.name}</span>
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>
      )}

      {globalPlayer && (
        <div className="mt-6">
          <h2 className="mb-2 text-xs font-medium text-neutral-500">ประวัติการแข่งขัน</h2>

          {tournamentPlayers.length === 0 ? (
            <EmptyState title="ยังไม่มีประวัติการแข่งขัน" />
          ) : (
            <div className="space-y-4">
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
                    <div className="flex items-center justify-between gap-2">
                      <Link
                        href={`/t/${tp.tournamentId}`}
                        className="min-w-0 truncate font-medium hover:underline"
                      >
                        {tp.tournament.name}
                      </Link>
                      <div className="flex shrink-0 items-center gap-2">
                        {rankByTournamentId.has(tp.tournamentId) && (
                          <Badge variant="success">อันดับที่ {rankByTournamentId.get(tp.tournamentId)}</Badge>
                        )}
                        <span className="text-xs text-neutral-500">#{tp.tournamentPlayerNo}</span>
                      </div>
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
          )}
        </div>
      )}

      {!globalPlayer && myRequests.length === 0 && !query && (
        <div className="mt-6">
          <EmptyState title="ยังไม่มีคำขอผูกบัญชี" description="ค้นหาชื่อผู้เล่นด้านบนเพื่อเริ่มต้น" />
        </div>
      )}
    </main>
  );
}
