import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireTournamentAccess } from "@/lib/dal";
import { TabLink } from "@/components/ui/TabLink";
import { Badge } from "@/components/ui/Badge";
import { TOURNAMENT_STATUS_BADGE } from "@/lib/status-labels";

const TABS = [
  { href: "", label: "Scoreboard" },
  { href: "/players", label: "Players" },
  { href: "/rounds", label: "Rounds" },
  { href: "/tables", label: "Tables / QR" },
  { href: "/practice", label: "Practice Link" },
  { href: "/staff", label: "Staff" },
  { href: "/settings", label: "Settings" },
];

export default async function TournamentAdminLayout(props: LayoutProps<"/admin/tournaments/[id]">) {
  const { id } = await props.params;
  const user = await requireTournamentAccess(id);

  const tournament = await prisma.tournament.findUnique({ where: { id } });
  if (!tournament) notFound();

  const tabs = TABS.filter(
    (t) =>
      (t.label !== "Staff" || user.role === "ADMIN") &&
      (t.label !== "Practice Link" || tournament.mode === "PRACTICE")
  );
  const status = TOURNAMENT_STATUS_BADGE[tournament.status];

  return (
    <div>
      <Link href="/admin/tournaments" className="text-xs text-neutral-500 hover:underline">
        ← All Tournaments
      </Link>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="min-w-0 break-words text-xl font-semibold text-neutral-900">
          {tournament.name}
        </h1>
        <Badge variant={status.variant} className="shrink-0">
          {status.label}
        </Badge>
      </div>
      <p className="text-xs text-neutral-500">{tournament.mode}</p>

      <nav className="mt-6 flex flex-wrap gap-1 border-b border-neutral-200/70">
        {tabs.map((tab) => (
          <TabLink key={tab.label} href={`/admin/tournaments/${id}${tab.href}`}>
            {tab.label}
          </TabLink>
        ))}
      </nav>

      <div className="mt-6">{props.children}</div>
    </div>
  );
}
