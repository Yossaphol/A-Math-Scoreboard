import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { LinkRow } from "@/components/ui/LinkRow";
import { AutoRefresh } from "@/components/ui/AutoRefresh";
import { PAIRING_METHOD_LABEL, ROUND_STATUS_BADGE } from "@/lib/status-labels";
import { roundLimitOf } from "@/lib/tournament-limits";
import { healStuckRounds } from "@/lib/match/round-completion";

export default async function AdminRoundsPage(props: PageProps<"/admin/tournaments/[id]/rounds">) {
  const { id } = await props.params;
  await healStuckRounds(id);
  const [tournament, rounds] = await Promise.all([
    prisma.tournament.findUniqueOrThrow({
      where: { id },
      select: { setNumberOfGames: true, numberOfGames: true },
    }),
    // Newest first — the round being played is the one staff open, not Round 1.
    prisma.round.findMany({
      where: { tournamentId: id },
      orderBy: { roundNumber: "desc" },
      include: {
        matches: { select: { status: true, byeClaimedById: true, player2Id: true } },
        _count: { select: { absences: true } },
      },
    }),
  ]);

  if (rounds.length === 0) {
    return <EmptyState title="ยังไม่มี Round" description='เริ่ม Round แรกได้จากปุ่ม "+ New Round" ในแท็บ Scoreboard' />;
  }

  const roundLimit = roundLimitOf(tournament);
  const inProgress = rounds.some((r) => r.status === "CONFIRMED");

  return (
    <div>
      {/* Results come in from the tables while a round is on — keep progress current. */}
      {inProgress && <AutoRefresh intervalMs={8000} />}
      <p className="mb-3 text-xs text-neutral-500">
        {roundLimit != null
          ? `สร้างแล้ว ${rounds.length} จาก ${roundLimit} รอบ`
          : `สร้างแล้ว ${rounds.length} รอบ (ไม่ได้กำหนดจำนวนรอบ)`}
      </p>

      <Card padding="p-0" className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200/70 text-left text-xs text-neutral-500">
              <th className="py-3 pl-5 pr-3">Round</th>
              <th className="py-3 pr-3">วิธีจับคู่</th>
              <th className="py-3 pr-3">คะแนนสูงสุด</th>
              <th className="py-3 pr-3">ความคืบหน้า</th>
              <th className="py-3 pr-3">ต้องจัดการ</th>
              <th className="py-3 pr-5">สถานะ</th>
            </tr>
          </thead>
          <tbody>
            {rounds.map((r) => {
              const status = ROUND_STATUS_BADGE[r.status];
              const href = `/admin/tournaments/${id}/rounds/${r.id}`;
              const total = r.matches.length;
              const done = r.matches.filter((m) => m.status === "CONFIRMED" || m.status === "BYE").length;
              const conflicts = r.matches.filter((m) => m.status === "CONFLICT").length;
              const byeClaims = r.matches.filter(
                (m) => m.byeClaimedById && m.player2Id && m.status !== "CONFIRMED"
              ).length;
              const percent = total === 0 ? 0 : Math.round((done / total) * 100);
              // Progress only means something once the pairing is locked in.
              const showProgress = r.status === "CONFIRMED" || r.status === "COMPLETED";

              return (
                <LinkRow
                  key={r.id}
                  href={href}
                  className={`border-b border-neutral-100 last:border-0 ${
                    r.status === "CONFIRMED" ? "bg-success/5" : ""
                  }`}
                >
                  <td className="py-3 pl-5 pr-3">
                    <Link href={href} className="font-medium hover:underline">
                      {r.roundNumber}
                    </Link>
                  </td>
                  <td className="py-3 pr-3">{r.pairingMethod ? PAIRING_METHOD_LABEL[r.pairingMethod] : "—"}</td>
                  <td className="py-3 pr-3">{r.maximumScoreEnabled ? r.maximumScore : "ปิด"}</td>
                  <td className="py-3 pr-3">
                    {showProgress ? (
                      <div className="flex min-w-[9rem] items-center gap-2">
                        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-neutral-200/80">
                          <div className="h-full rounded-full bg-success" style={{ width: `${percent}%` }} />
                        </div>
                        <span className="text-xs tabular-nums text-neutral-600">
                          {done}/{total}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-neutral-400">{total} แมตช์ · ยังไม่ Confirm</span>
                    )}
                  </td>
                  <td className="py-3 pr-3">
                    <div className="flex flex-wrap gap-1">
                      {conflicts > 0 && <Badge variant="danger">ผลขัดแย้ง {conflicts}</Badge>}
                      {byeClaims > 0 && <Badge variant="danger">แจ้งคู่ไม่มา {byeClaims}</Badge>}
                      {r._count.absences > 0 && <Badge variant="neutral">ไม่มา {r._count.absences}</Badge>}
                      {conflicts + byeClaims + r._count.absences === 0 && (
                        <span className="text-xs text-neutral-300">—</span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 pr-5">
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </td>
                </LinkRow>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
