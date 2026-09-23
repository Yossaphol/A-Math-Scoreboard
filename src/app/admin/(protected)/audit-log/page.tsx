import { requireAdmin } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageSizeSelect } from "@/components/ui/PageSizeSelect";
import { Pagination } from "@/components/ui/Pagination";

const DEFAULT_PAGE_SIZE = 30;

export default async function AuditLogPage(props: PageProps<"/admin/audit-log">) {
  await requireAdmin();
  const { page: pageParam, pageSize: pageSizeParam } = await props.searchParams;
  const pageSize = Math.min(500, Math.max(1, Number(pageSizeParam) || DEFAULT_PAGE_SIZE));

  const totalCount = await prisma.auditLog.count();
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const page = Math.min(Math.max(1, Number(pageParam) || 1), totalPages);

  const entries = await prisma.auditLog.findMany({
    include: { actor: true },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * pageSize,
    take: pageSize,
  });

  const buildHref = (targetPage: number) => {
    const sp = new URLSearchParams();
    sp.set("pageSize", String(pageSize));
    sp.set("page", String(targetPage));
    return `/admin/audit-log?${sp.toString()}`;
  };

  return (
    <div>
      <PageHeader title="Audit Log" subtitle="ประวัติการกระทำของ Admin/Staff ที่มีผลต่อข้อมูลจริง" />

      {entries.length === 0 ? (
        <EmptyState title="ยังไม่มีประวัติ" />
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
                      timeZone: "Asia/Bangkok",
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
