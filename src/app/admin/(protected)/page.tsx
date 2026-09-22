import Link from "next/link";
import { requireUser } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

// Prisma Postgres Free plan storage limit — https://www.prisma.io/pricing (500 MB).
// Update this if the project's plan ever changes.
const DB_FREE_TIER_BYTES = 500 * 1024 * 1024;

export default async function AdminDashboardPage() {
  const user = await requireUser();

  if (user.role === "ADMIN") {
    const [tournamentCount, playerCount, staffCount, dbSizeRows] = await Promise.all([
      prisma.tournament.count(),
      prisma.globalPlayer.count(),
      prisma.tournamentStaff.count({ where: { status: "ACTIVE" } }),
      prisma.$queryRaw<{ bytes: bigint }[]>`SELECT pg_database_size(current_database()) AS bytes`,
    ]);
    const dbBytes = Number(dbSizeRows[0].bytes);

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
        <div className="mt-4">
          <DatabaseUsageCard bytes={dbBytes} limitBytes={DB_FREE_TIER_BYTES} />
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

function formatBytes(bytes: number) {
  const mb = bytes / (1024 * 1024);
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}

function DatabaseUsageCard({ bytes, limitBytes }: { bytes: number; limitBytes: number }) {
  const pct = Math.min(100, (bytes / limitBytes) * 100);
  const barColorClass = pct >= 90 ? "bg-danger" : pct >= 70 ? "bg-warning" : "bg-success";
  const textColorClass = pct >= 90 ? "text-danger" : pct >= 70 ? "text-warning" : "text-success";

  return (
    <Card padding="p-5">
      <div className="flex items-baseline justify-between">
        <p className="text-xs text-neutral-500">Database Storage (Free Tier)</p>
        <p className={`text-xs font-medium ${textColorClass}`}>{pct.toFixed(1)}%</p>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-neutral-200/70">
        <div
          className={`h-full rounded-full ${barColorClass} transition-[width]`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-neutral-400">
        {formatBytes(bytes)} / {formatBytes(limitBytes)} ใช้ไป
      </p>
    </Card>
  );
}
