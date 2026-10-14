import Link from "next/link";

/**
 * Segmented "ทุกคน · ชาย · หญิง" switch above a Scoreboard (?group=<id>), each with its head
 * count. A group tab shows that group's players ranked among themselves — points are the same
 * tally as the overall table, never a separate one. Renders nothing without groups.
 */
export function GroupTabs({
  basePath,
  groups,
  totalCount,
  activeGroupId,
  split = false,
}: {
  basePath: string;
  groups: { id: string; name: string; playerCount: number }[];
  totalCount: number;
  activeGroupId: string | null;
  // The latest Round was paired within groups.
  split?: boolean;
}) {
  if (groups.length === 0) return null;
  const tabs = [{ id: null, name: "ทุกคน", playerCount: totalCount }, ...groups];
  const active = groups.find((g) => g.id === activeGroupId);

  return (
    <div className="mb-4">
      <nav aria-label="ดูอันดับตามกลุ่ม" className="-mx-1 overflow-x-auto px-1">
        <div className="inline-flex gap-1 rounded-xl bg-black/[0.05] p-1">
          {tabs.map((t) => {
            const isActive = t.id === (active?.id ?? null);
            return (
              <Link
                key={t.id ?? "all"}
                href={t.id ? `${basePath}?group=${t.id}` : basePath}
                scroll={false}
                aria-current={isActive ? "page" : undefined}
                className={`flex min-h-9 items-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-neutral-900 ${
                  isActive
                    ? "bg-white font-medium text-neutral-900 shadow-sm"
                    : "text-neutral-600 hover:bg-white/60 hover:text-neutral-900"
                }`}
              >
                {t.name}
                <span
                  className={`rounded-full px-1.5 text-[11px] tabular-nums ${
                    isActive ? "bg-neutral-900 text-white" : "bg-black/[0.06] text-neutral-500"
                  }`}
                >
                  {t.playerCount}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
      <p className="mt-2 text-xs text-neutral-500">
        {active
          ? `อันดับภายในกลุ่ม ${active.name} — Points และ Diff เป็นยอดสะสมเดียวกับตารางรวม`
          : split
            ? "Round ล่าสุดแยกจับคู่ตามกลุ่ม — เลือกแท็บกลุ่มเพื่อดูอันดับภายในกลุ่ม"
            : "อันดับรวมทุกคน"}
      </p>
    </div>
  );
}
