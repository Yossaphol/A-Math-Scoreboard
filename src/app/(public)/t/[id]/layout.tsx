import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { TabLink } from "@/components/ui/TabLink";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { TOURNAMENT_STATUS_BADGE } from "@/lib/status-labels";
import { hasPracticeAccess } from "@/lib/practice-lock";
import { unlockPracticeTournament } from "@/lib/actions/tournaments";
import { inputClass } from "@/components/ui/styles";

const TABS = [
  { href: "", label: "Pairing" },
  { href: "/scoreboard", label: "Scoreboard" },
  { href: "/rounds", label: "Rounds" },
  { href: "/players", label: "Players" },
];

export default async function TournamentLayout(props: LayoutProps<"/t/[id]">) {
  const { id } = await props.params;

  const tournament = await prisma.tournament.findUnique({ where: { id } });
  if (!tournament) notFound();

  const status = TOURNAMENT_STATUS_BADGE[tournament.status];
  const unlocked = await hasPracticeAccess(tournament);

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <Link href="/" className="text-xs text-neutral-500 hover:underline">
        ← Tournaments
      </Link>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="min-w-0 break-words text-2xl font-semibold text-neutral-900">
          {tournament.name}
        </h1>
        <Badge variant={status.variant} className="shrink-0">
          {status.label}
        </Badge>
      </div>
      <p className="text-xs text-neutral-500">
        {tournament.mode === "PRACTICE" ? "Practice" : "Competition"}
      </p>

      {unlocked ? (
        <>
          <nav className="mt-6 flex flex-wrap gap-1 border-b border-neutral-200/70">
            {TABS.map((tab) => (
              <TabLink key={tab.label} href={`/t/${id}${tab.href}`}>
                {tab.label}
              </TabLink>
            ))}
          </nav>

          <div className="mt-6">{props.children}</div>
        </>
      ) : (
        <Card className="mt-6 max-w-sm">
          <p className="text-sm font-medium text-neutral-900">Tournament นี้ต้องใส่รหัสผ่าน</p>
          <p className="mt-1 text-xs text-neutral-500">
            เป็น Practice Tournament ที่ตั้งรหัสผ่านไว้ — ขอรหัสจาก Admin หรือ Staff ที่จัดการฝึกซ้อมนี้
          </p>
          <form action={unlockPracticeTournament} className="mt-4 flex items-end gap-2">
            <input type="hidden" name="tournamentId" value={id} />
            <div className="flex-1">
              <label className="text-xs font-medium text-neutral-500">รหัสผ่าน</label>
              <input
                name="pin"
                inputMode="numeric"
                autoComplete="off"
                required
                className={`${inputClass} mt-1`}
              />
            </div>
            <Button type="submit">เข้าดู</Button>
          </form>
        </Card>
      )}
    </main>
  );
}
