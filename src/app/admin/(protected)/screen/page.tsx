import Link from "next/link";
import { redirect } from "next/navigation";
import { requireStaffOrAdmin } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { TOURNAMENT_STATUS_BADGE } from "@/lib/status-labels";

/**
 * "เปิดจอห้องแข่ง" from the sidebar: straight to the hall screen when one tournament is
 * running, otherwise a pick list (Staff: only the tournaments they run).
 */
export default async function OpenHallScreenPage() {
  const user = await requireStaffOrAdmin();
  const tournaments = await prisma.tournament.findMany({
    where: {
      status: { in: ["ONGOING", "UPCOMING"] },
      ...(user.role === "ADMIN" ? {} : { staff: { some: { userId: user.id, status: "ACTIVE" } } }),
    },
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    select: { id: true, name: true, status: true, mode: true },
  });

  const ongoing = tournaments.filter((t) => t.status === "ONGOING");
  if (ongoing.length === 1) redirect(`/screen/${ongoing[0].id}`);

  return (
    <div>
      <PageHeader title="เปิดจอห้องแข่ง" subtitle="เลือก Tournament ที่จะขึ้นจอ (เปิดบนเครื่องที่ต่อทีวี/โปรเจกเตอร์ แล้วกดเต็มจอ)" />
      {tournaments.length === 0 ? (
        <Card className="text-center text-sm text-neutral-500">ยังไม่มี Tournament ที่กำลังแข่งหรือกำลังจะเริ่ม</Card>
      ) : (
        <ul className="space-y-2">
          {tournaments.map((t) => {
            const status = TOURNAMENT_STATUS_BADGE[t.status];
            return (
              <li key={t.id}>
                <Link href={`/screen/${t.id}`}>
                  <Card padding="p-4" className="flex items-center justify-between gap-3 transition-shadow hover:shadow-md">
                    <span className="min-w-0 truncate font-medium text-neutral-900">{t.name}</span>
                    <span className="flex shrink-0 items-center gap-2">
                      <Badge variant={status.variant}>{status.label}</Badge>
                      <span className="text-xs text-neutral-400">{t.mode}</span>
                      <span className="text-neutral-400">↗</span>
                    </span>
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
