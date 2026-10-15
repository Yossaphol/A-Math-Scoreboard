import Link from "next/link";
import { requireUser } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { getSetupChecklist, type ChecklistStep } from "@/lib/setup-checklist";

// Supabase Free plan database size limit — https://supabase.com/pricing (500 MB).
// Update this if the project's plan ever changes.
const DB_FREE_TIER_BYTES = 500 * 1024 * 1024;

export default async function AdminDashboardPage() {
  const user = await requireUser();

  if (user.role === "ADMIN") {
    const [tournamentCount, playerCount, staffCount, dbSizeRows, checklist] = await Promise.all([
      prisma.tournament.count(),
      prisma.globalPlayer.count(),
      prisma.tournamentStaff.count({ where: { status: "ACTIVE" } }),
      prisma.$queryRaw<{ bytes: bigint }[]>`SELECT pg_database_size(current_database()) AS bytes`,
      getSetupChecklist(),
    ]);
    const dbBytes = Number(dbSizeRows[0].bytes);

    return (
      <div>
        <PageHeader
          title="Dashboard"
          actions={<LinkButton href="/admin/tournaments/new">+ Create Tournament</LinkButton>}
        />
        <div className="grid grid-cols-3 gap-4">
          <StatCard label="Tournaments" value={tournamentCount} href="/admin/tournaments" />
          <StatCard label="Global Players" value={playerCount} href="/admin/players" />
          <StatCard label="Active Staff" value={staffCount} href="/admin/staff" />
        </div>
        <div className="mt-4">
          <SetupChecklist tournament={checklist.tournament} steps={checklist.steps} />
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

function StatCard({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <Link href={href} className="block">
      <Card padding="p-5" className="transition-shadow hover:shadow-md">
        <p className="text-2xl font-semibold text-neutral-900">{value}</p>
        <p className="text-xs text-neutral-500">{label}</p>
      </Card>
    </Link>
  );
}

// From a new Tournament to results on the board — ticked off against the Tournament being
// prepared or played (lib/setup-checklist.ts). The first unticked required step is "next".
function SetupChecklist({
  tournament,
  steps,
}: {
  tournament: { id: string; name: string } | null;
  steps: ChecklistStep[];
}) {
  const required = steps.filter((s) => !s.optional && s.done !== null);
  const doneCount = required.filter((s) => s.done).length;
  const next = required.find((s) => !s.done);

  return (
    <Card padding="p-0">
      <div className="flex flex-wrap items-end justify-between gap-3 px-5 pb-3 pt-5">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-neutral-900">ขั้นตอนการจัดแข่ง</p>
          <p className="mt-0.5 truncate text-xs text-neutral-500">
            {tournament ? (
              <>
                ติดตามจาก{" "}
                <Link href={`/admin/tournaments/${tournament.id}`} className="font-medium text-neutral-700 hover:underline">
                  {tournament.name}
                </Link>
              </>
            ) : (
              "ยังไม่มี Tournament ที่กำลังเตรียมหรือกำลังแข่ง — เริ่มจากสร้างใหม่"
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-neutral-200/70">
            <div
              className="h-full rounded-full bg-success"
              style={{ width: `${Math.round((doneCount / required.length) * 100)}%` }}
            />
          </div>
          <span className="text-xs tabular-nums text-neutral-500">
            {doneCount}/{required.length}
          </span>
        </div>
      </div>
      <ol className="border-t border-neutral-200/70">
        {steps.map((step, i) => {
          const isNext = step === next;
          return (
            <li key={step.key} className="border-b border-neutral-100 last:border-0">
              <Link
                href={step.href}
                className={`flex items-start gap-3 px-5 py-3 transition-colors ${
                  isNext ? "bg-accent/[0.04] hover:bg-accent/[0.07]" : "hover:bg-black/[0.02]"
                }`}
              >
                <StepMark number={i + 1} done={step.done} isNext={isNext} />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-2">
                    <span
                      className={`text-sm ${
                        step.done ? "text-neutral-400 line-through decoration-neutral-300" : "font-medium text-neutral-900"
                      }`}
                    >
                      {step.title}
                    </span>
                    {step.optional && <span className="text-[11px] text-neutral-400">ไม่บังคับ</span>}
                    {step.meta && <span className="text-[11px] text-neutral-500">· {step.meta}</span>}
                  </span>
                  {!step.done && <span className="mt-0.5 block text-xs text-neutral-500">{step.detail}</span>}
                </span>
                {isNext && <span className="shrink-0 self-center text-xs font-medium text-accent">ทำขั้นนี้ →</span>}
              </Link>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

function StepMark({ number, done, isNext }: { number: number; done: boolean | null; isNext: boolean }) {
  if (done) {
    return (
      <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-success text-white" aria-label="เสร็จแล้ว">
        <svg viewBox="0 0 24 24" fill="none" className="size-3" aria-hidden="true">
          <path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    );
  }
  return (
    <span
      className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-medium tabular-nums ${
        isNext
          ? "bg-neutral-900 text-white"
          : done === null
            ? "border border-dashed border-neutral-300 text-neutral-400"
            : "border border-neutral-300 text-neutral-500"
      }`}
    >
      {number}
    </span>
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
