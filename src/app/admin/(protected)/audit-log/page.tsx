import type { Prisma } from "@/generated/prisma/client";
import { requireAdmin } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageSizeSelect } from "@/components/ui/PageSizeSelect";
import { Pagination } from "@/components/ui/Pagination";
import { Button, LinkButton } from "@/components/ui/Button";
import { inputClass, labelClass } from "@/components/ui/styles";

const DEFAULT_PAGE_SIZE = 30;
const TIME_ZONE = "Asia/Bangkok";
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** YYYY-MM-DD for "now" as seen in Bangkok — what the date inputs and the "วันนี้" shortcut mean. */
function todayInBangkok(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: TIME_ZONE });
}

/** Start of a Bangkok calendar day (YYYY-MM-DD) as a UTC instant. Bangkok has no DST, so +07:00 is always right. */
function startOfDay(date: string, addDays = 0): Date {
  const d = new Date(`${date}T00:00:00+07:00`);
  d.setUTCDate(d.getUTCDate() + addDays);
  return d;
}

const asString = (v: string | string[] | undefined) => (typeof v === "string" ? v.trim() : "");

export default async function AuditLogPage(props: PageProps<"/admin/audit-log">) {
  await requireAdmin();
  const params = await props.searchParams;
  const pageSize = Math.min(500, Math.max(1, Number(params.pageSize) || DEFAULT_PAGE_SIZE));
  const query = asString(params.q);
  const actorId = asString(params.actor);
  let from = DATE_RE.test(asString(params.from)) ? asString(params.from) : "";
  let to = DATE_RE.test(asString(params.to)) ? asString(params.to) : "";
  if (from && to && from > to) [from, to] = [to, from];
  const today = todayInBangkok();

  // Each whitespace-separated word must appear somewhere in the summary (like piping grep
  // through grep), so "ลบ ผู้เล่น" finds "ลบผู้เล่น ..." without needing the exact phrase.
  const words = query.split(/\s+/).filter(Boolean);
  const where: Prisma.AuditLogWhereInput = {
    ...(actorId && { actorId }),
    ...((from || to) && {
      createdAt: {
        ...(from && { gte: startOfDay(from) }),
        ...(to && { lt: startOfDay(to, 1) }),
      },
    }),
    ...(words.length > 0 && {
      AND: words.map((w) => ({ summary: { contains: w, mode: "insensitive" as const } })),
    }),
  };
  const isFiltered = Boolean(query || actorId || from || to);

  const [totalCount, actors] = await Promise.all([
    prisma.auditLog.count({ where }),
    // Only people who have actually done something — the dropdown would otherwise list every user.
    prisma.user.findMany({
      where: { auditLogs: { some: {} } },
      select: { id: true, name: true, email: true },
      orderBy: { email: "asc" },
    }),
  ]);
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const page = Math.min(Math.max(1, Number(params.page) || 1), totalPages);

  const entries = await prisma.auditLog.findMany({
    where,
    include: { actor: true },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * pageSize,
    take: pageSize,
  });

  const buildHref = (targetPage: number) => {
    const sp = new URLSearchParams();
    if (query) sp.set("q", query);
    if (actorId) sp.set("actor", actorId);
    if (from) sp.set("from", from);
    if (to) sp.set("to", to);
    sp.set("pageSize", String(pageSize));
    sp.set("page", String(targetPage));
    return `/admin/audit-log?${sp.toString()}`;
  };

  return (
    <div>
      <PageHeader title="Audit Log" subtitle="ประวัติการกระทำของ Admin/Staff ที่มีผลต่อข้อมูลจริง" />

      <form className="mb-6 flex flex-wrap items-end gap-3">
        {/* Reset to page 1 whenever the filter itself changes. */}
        <input type="hidden" name="page" value="1" />
        <input type="hidden" name="pageSize" value={pageSize} />
        <label className="flex min-w-56 grow basis-64 flex-col gap-1">
          <span className={labelClass}>ค้นหารายละเอียด</span>
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="เช่น ลบผู้เล่น, แก้ไขผล"
            className={inputClass}
          />
        </label>
        <label className="flex min-w-48 grow basis-48 flex-col gap-1">
          <span className={labelClass}>ผู้ทำรายการ</span>
          <select name="actor" defaultValue={actorId} className={inputClass}>
            <option value="">ทุกคน</option>
            {actors.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name ? `${a.name} (${a.email})` : a.email}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className={labelClass}>ตั้งแต่วันที่</span>
          <input type="date" name="from" defaultValue={from} max={today} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1">
          <span className={labelClass}>ถึงวันที่</span>
          <input type="date" name="to" defaultValue={to} max={today} className={inputClass} />
        </label>
        <div className="flex gap-2">
          <Button type="submit">ค้นหา</Button>
          <LinkButton
            variant="secondary"
            href={`/admin/audit-log?${new URLSearchParams({
              ...(query && { q: query }),
              ...(actorId && { actor: actorId }),
              from: today,
              to: today,
              pageSize: String(pageSize),
            }).toString()}`}
          >
            วันนี้
          </LinkButton>
          {isFiltered && (
            <LinkButton variant="ghost" href={`/admin/audit-log?pageSize=${pageSize}`}>
              ล้าง
            </LinkButton>
          )}
        </div>
      </form>

      {entries.length === 0 ? (
        <EmptyState title={isFiltered ? "ไม่พบรายการที่ตรงกับเงื่อนไข" : "ยังไม่มีประวัติ"} />
      ) : (
        <Card padding="p-0" className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200/70 text-left text-xs text-neutral-500">
                <th className="py-3 pl-5 pr-3">เวลา</th>
                <th className="py-3 pr-3">ผู้ทำรายการ</th>
                <th className="py-3 pr-5">รายละเอียด</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-b border-neutral-100 last:border-0 align-top">
                  <td className="whitespace-nowrap py-3 pl-5 pr-3 text-xs text-neutral-500">
                    {e.createdAt.toLocaleString("th-TH", {
                      dateStyle: "medium",
                      timeStyle: "short",
                      timeZone: TIME_ZONE,
                    })}
                  </td>
                  <td className="py-3 pr-3 text-xs text-neutral-500">
                    {e.actor.name || e.actor.email}
                  </td>
                  <td className="py-3 pr-5">{e.summary}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {totalCount > 0 && (
        <div className="mt-4 flex w-full flex-wrap items-center justify-between gap-6 max-sm:justify-center">
          <PageSizeSelect value={pageSize} />
          <p className="grow text-center text-sm text-neutral-500 sm:text-right">
            แสดง <span className="font-medium text-neutral-900">{totalCount === 0 ? 0 : (page - 1) * pageSize + 1}</span>{" "}
            ถึง <span className="font-medium text-neutral-900">{Math.min(page * pageSize, totalCount)}</span> จาก{" "}
            <span className="font-medium text-neutral-900">{totalCount}</span> รายการ
          </p>
          <Pagination page={page} totalPages={totalPages} buildHref={buildHref} />
        </div>
      )}
    </div>
  );
}
