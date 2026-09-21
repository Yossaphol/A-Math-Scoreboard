import Link from "next/link";
import { requireUser } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

export default async function AdminDashboardPage() {
  const user = await requireUser();

  if (user.role === "ADMIN") {
    const [tournamentCount, playerCount, staffCount] = await Promise.all([
      prisma.tournament.count(),
      prisma.globalPlayer.count(),
      prisma.tournamentStaff.count({ where: { status: "ACTIVE" } }),
    ]);

    return (
      <div>
        <PageHeader
          title="Dashboard"
          actions={<LinkButton href="/admin/tournaments/new">+ Create Tournament</LinkButton>}
        />
        <div className="grid grid-cols-3 gap-4">
          <StatCard label="Tournaments" value={tournamentCount} />
          <StatCard label="Global Players" value={playerCount} />
          <StatCard label="Active Staff" value={staffCount} />
        </div>
      </div>
    );
  }

  // STAFF: only their assigned, ACTIVE tournaments (spec §6).
  const assignments = await prisma.tournamentStaff.findMany({
    where: { userId: user.id, status: "ACTIVE" },
    include: { tournament: true },
    orderBy: { assignedAt: "desc" },
  });

  return (
    <div>
      <PageHeader title="My Tournaments" />
      {assignments.length === 0 ? (
        <EmptyState title="คุณยังไม่ได้รับมอบหมาย Tournament ใด" />
      ) : (
        <div className="space-y-2">
          {assignments.map((a) => (
            <Link key={a.id} href={`/admin/tournaments/${a.tournamentId}`} className="block">
              <Card className="transition-shadow hover:shadow-md" padding="p-4">
                <p className="text-sm font-medium">{a.tournament.name}</p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card padding="p-5">
      <p className="text-2xl font-semibold text-neutral-900">{value}</p>
      <p className="text-xs text-neutral-500">{label}</p>
    </Card>
  );
}
