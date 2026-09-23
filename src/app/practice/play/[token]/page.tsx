import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { submitSelfServiceResult } from "@/lib/actions/self-service";
import { ResultForm } from "@/components/match/ResultForm";
import { NewSelfServiceMatchForm } from "@/components/match/NewSelfServiceMatchForm";
import { Card } from "@/components/ui/Card";

// Practice-only self-service scoring: public, no auth, no staff-created Round required at
// all (spec: players can log a game any time). "Who am I" is a URL search param, not a
// session — same no-auth-at-the-table model as /table/[qrToken], just without a physical
// table to detect the match from, since there's no pre-made pairing here. Lives at
// /practice/play/[token] (not /practice/[token]) so it doesn't collide with the
// /practice/[id] tournament-detail route.
export default async function PracticeSelfServicePage(props: PageProps<"/practice/play/[token]">) {
  const { token } = await props.params;
  const { me } = await props.searchParams;

  const tournament = await prisma.tournament.findUnique({ where: { selfServiceToken: token } });
  if (!tournament || tournament.mode !== "PRACTICE") {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
        <Card className="text-center">
          <p className="text-sm text-neutral-500">ไม่พบลิงก์นี้</p>
        </Card>
      </main>
    );
  }

  const activePlayers = await prisma.tournamentPlayer.findMany({
    where: { tournamentId: tournament.id, status: "ACTIVE" },
    include: { globalPlayer: true },
    orderBy: { tournamentPlayerNo: "asc" },
  });

  const meId = typeof me === "string" ? me : undefined;
  const selfPlayer = meId ? activePlayers.find((p) => p.id === meId) : undefined;

  if (!selfPlayer) {
    return (
      <main className="mx-auto max-w-md px-4 py-10">
        <h1 className="text-center text-lg font-semibold text-neutral-900">
          {tournament.name} — เลือกชื่อคุณ
        </h1>
        {activePlayers.length === 0 ? (
          <p className="mt-6 text-center text-sm text-neutral-500">ยังไม่มีผู้เล่นในทัวร์นาเมนต์นี้</p>
        ) : (
          <div className="mt-6 space-y-2">
            {activePlayers.map((p) => (
              <Link
                key={p.id}
                href={`/practice/play/${token}?me=${p.id}`}
                className="block rounded-lg border border-neutral-200 px-4 py-3 text-sm hover:border-accent"
              >
                {p.globalPlayer.name}{" "}
                <span className="text-neutral-400">#{p.tournamentPlayerNo}</span>
              </Link>
            ))}
          </div>
        )}
      </main>
    );
  }

  const pendingMatches = await prisma.match.findMany({
    where: {
      tournamentId: tournament.id,
      roundId: null,
      status: { in: ["SUBMITTED", "CONFLICT"] },
      OR: [{ player1Id: selfPlayer.id }, { player2Id: selfPlayer.id }],
    },
    include: {
      player1: { include: { globalPlayer: true } },
      player2: { include: { globalPlayer: true } },
      submissions: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const waitingOnMe = pendingMatches.filter((m) => {
    const mySide = m.player1Id === selfPlayer.id ? "PLAYER1" : "PLAYER2";
    const mySubmission = m.submissions.find((s) => s.side === mySide);
    return m.status === "CONFLICT" || !mySubmission;
  });

  const opponents = activePlayers.filter((p) => p.id !== selfPlayer.id);

  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <p className="text-center text-xs text-neutral-500">{tournament.name}</p>
      <h1 className="mt-1 text-center text-lg font-semibold text-neutral-900">
        สวัสดี {selfPlayer.globalPlayer.name}
      </h1>
      <p className="text-center text-[11px] text-neutral-400">
        <Link href={`/practice/play/${token}`} className="hover:underline">
          ไม่ใช่คุณ? เลือกใหม่
        </Link>
      </p>

      {waitingOnMe.length > 0 && (
        <section className="mt-6">
          <h2 className="text-sm font-medium text-neutral-900">รอคุณยืนยัน</h2>
          <div className="mt-2 space-y-4">
            {waitingOnMe.map((m) => {
              const mySide = m.player1Id === selfPlayer.id ? "PLAYER1" : "PLAYER2";
              const submissionBySide = new Map(m.submissions.map((s) => [s.side, s]));
              const theirs = submissionBySide.get(mySide === "PLAYER1" ? "PLAYER2" : "PLAYER1");
              const opponentName =
                mySide === "PLAYER1" ? m.player2!.globalPlayer.name : m.player1.globalPlayer.name;
              return (
                <ResultForm
                  key={m.id}
                  action={submitSelfServiceResult}
                  extraHiddenFields={{ token }}
                  matchId={m.id}
                  side={mySide}
                  player1Name={m.player1.globalPlayer.name}
                  player2Name={m.player2!.globalPlayer.name}
                  previous={m.status === "CONFLICT" ? submissionBySide.get(mySide) : undefined}
                  opponentReport={
                    theirs
                      ? { byName: opponentName, player1Score: theirs.player1Score, player2Score: theirs.player2Score }
                      : undefined
                  }
                  meta={`เริ่มเกมเมื่อ ${formatBangkok(m.createdAt)}`}
                  heading={
                    m.status === "CONFLICT"
                      ? "ผลไม่ตรงกัน กรุณาตรวจสอบและส่งอีกครั้ง"
                      : `${m.player1.globalPlayer.name} vs ${m.player2!.globalPlayer.name}`
                  }
                />
              );
            })}
          </div>
        </section>
      )}

      <section className="mt-8">
        <h2 className="text-sm font-medium text-neutral-900">เริ่มเกมใหม่</h2>
        {opponents.length === 0 ? (
          <p className="mt-2 text-xs text-neutral-500">ไม่มีคู่แข่งอื่นในทัวร์นาเมนต์นี้</p>
        ) : (
          <div className="mt-2">
            <NewSelfServiceMatchForm
              token={token}
              selfPlayerId={selfPlayer.id}
              selfName={selfPlayer.globalPlayer.name}
              opponents={opponents.map((o) => ({ id: o.id, name: o.globalPlayer.name }))}
            />
          </div>
        )}
      </section>
    </main>
  );
}

// Same format as the Audit Log — forced to Bangkok time since the server may run in UTC.
function formatBangkok(d: Date) {
  return d.toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" });
}
