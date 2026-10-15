import "server-only";
import { prisma } from "@/lib/prisma";
import { getSystemSettings } from "@/lib/system-settings";
import { roundLimitOf } from "@/lib/tournament-limits";

export type ChecklistStep = {
  key: string;
  title: string;
  detail: string;
  href: string;
  // true/false: worked out from the data. null: nothing to check it against (e.g. QR codes
  // printed) — shown as a reminder, never counted.
  done: boolean | null;
  optional?: boolean;
  meta?: string;
};

/**
 * "From a new Tournament to results on the board" for the Admin Dashboard, ticked off against
 * the COMPETITION Tournament being prepared or played most recently (none: a fresh start).
 */
export async function getSetupChecklist(): Promise<{
  tournament: { id: string; name: string } | null;
  steps: ChecklistStep[];
}> {
  const [t, { liveFeedEnabled }] = await Promise.all([
    prisma.tournament.findFirst({
      where: { mode: "COMPETITION", status: { in: ["UPCOMING", "ONGOING"] } },
      orderBy: { updatedAt: "desc" },
      include: {
        _count: { select: { groups: true, staff: { where: { status: "ACTIVE" } } } },
        rounds: { orderBy: { roundNumber: "desc" }, select: { roundNumber: true, status: true } },
      },
    }),
    getSystemSettings(),
  ]);

  const [activePlayers, ungrouped] = t
    ? await Promise.all([
        prisma.tournamentPlayer.count({ where: { tournamentId: t.id, status: "ACTIVE" } }),
        prisma.tournamentPlayer.count({ where: { tournamentId: t.id, status: "ACTIVE", groupId: null } }),
      ])
    : [0, 0];

  const base = t ? `/admin/tournaments/${t.id}` : null;
  const at = (path: string) => (base ? `${base}${path}` : "/admin/tournaments/new");
  const latest = t?.rounds[0];
  const played = t?.rounds.some((r) => r.status === "CONFIRMED" || r.status === "COMPLETED") ?? false;
  const limit = t ? roundLimitOf(t) : null;

  const steps: ChecklistStep[] = [
    {
      key: "create",
      title: "สร้าง Tournament",
      detail: "ตั้งชื่อ จำนวนเกม และ Maximum Score",
      href: "/admin/tournaments/new",
      done: !!t,
    },
    {
      key: "players",
      title: "เพิ่มผู้เล่น",
      detail: "เพิ่มทีละคน หรือนำเข้าจากไฟล์ .csv / .xlsx ในแท็บ Players",
      href: at("/players"),
      done: activePlayers >= 2,
      meta: t ? `${activePlayers} คน` : undefined,
    },
    {
      key: "groups",
      title: "แบ่งกลุ่ม",
      detail: "ถ้าจะแยกแข่ง เช่น ชาย / หญิง — สร้างกลุ่มแล้วเลือกกลุ่มให้ทุกคน ในแท็บ Players",
      href: at("/players"),
      done: t != null && t._count.groups > 0 && ungrouped === 0,
      optional: true,
      meta: t && t._count.groups > 0 && ungrouped > 0 ? `ยังไม่มีกลุ่ม ${ungrouped} คน` : undefined,
    },
    {
      key: "tables",
      title: "พิมพ์ QR ประจำโต๊ะ",
      detail: "ดาวน์โหลดในแท็บ Tables / QR แล้ววางทุกโต๊ะ — ผู้เล่นสแกนเพื่อกรอกผลเอง",
      href: at("/tables"),
      done: null,
    },
    {
      key: "staff",
      title: "เชิญ Staff",
      detail: "ให้ช่วยกรอกผลและรับเรียกกรรมการ ในแท็บ Staff",
      href: at("/staff"),
      done: t != null && t._count.staff > 0,
      optional: true,
    },
    {
      key: "live-feed",
      title: "เปิดระบบแจ้งเตือนสด",
      detail: "ให้หน้าโต๊ะเรียกกรรมการได้ และจอ Admin/Staff ได้รับแจ้งผล — ที่ ตั้งค่า",
      href: "/admin/settings",
      done: liveFeedEnabled,
    },
    {
      key: "round",
      title: "สร้าง Round แรก",
      detail: "+ New Round → เลือกวิธีจับคู่ → Generate Pairing → ตรวจคู่ → Confirm Pairing",
      href: at(""),
      done: played,
    },
    {
      key: "scores",
      title: "แข่งและกรอกผล",
      detail: "ผู้เล่นสแกน QR กรอกผลเอง หรือกรอกแทนที่เมนู กรอกผล · ผลไม่ตรงกันแก้ที่หน้า Round",
      href: t ? `/admin/score-entry?t=${t.id}` : "/admin/score-entry",
      done: latest?.status === "COMPLETED",
      meta: latest && latest.status !== "DRAFT" ? `Round ${latest.roundNumber}` : undefined,
    },
    {
      key: "finish",
      title: "เล่นให้ครบทุกเกม",
      detail:
        limit != null
          ? `เปิด Round ถัดไปจนครบ ${limit} เกม — ครบแล้ว Tournament จบเอง`
          : "เปิด Round ถัดไปจนจบ แล้วเปลี่ยนสถานะเป็น จบแล้ว ในแท็บ Settings",
      href: at(""),
      done: false, // a finished Tournament is no longer the one this list follows
      meta: limit != null && latest ? `${latest.roundNumber}/${limit}` : undefined,
    },
  ];

  return { tournament: t ? { id: t.id, name: t.name } : null, steps };
}
