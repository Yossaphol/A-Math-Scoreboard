import { requireAdmin } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { approveLinkRequest, rejectLinkRequest } from "@/lib/actions/link-requests";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import type { LinkRequest, GlobalPlayer, User } from "@/generated/prisma/client";

const STATUS_BADGE: Record<string, { label: string; variant: "warning" | "success" | "danger" }> = {
  PENDING: { label: "รอตรวจสอบ", variant: "warning" },
  APPROVED: { label: "อนุมัติแล้ว", variant: "success" },
  REJECTED: { label: "ถูกปฏิเสธ", variant: "danger" },
};

type RequestRow = LinkRequest & { user: User; globalPlayer: GlobalPlayer };

export default async function AccountRequestsPage() {
  await requireAdmin();

  const requests = await prisma.linkRequest.findMany({
    include: { user: true, globalPlayer: true },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 50,
  });

  const pending = requests.filter((r) => r.status === "PENDING");
  const reviewed = requests.filter((r) => r.status !== "PENDING");

  return (
    <div>
      <PageHeader
        title="Account Link Requests"
        subtitle="คำขอผูก Google Account เข้ากับ Global Player ID"
      />

      {requests.length === 0 ? (
        <EmptyState title="ยังไม่มีคำขอ" />
      ) : (
        <div className="space-y-4">
          {pending.length === 0 ? (
            <EmptyState title="ไม่มีคำขอที่รอตรวจสอบ" />
          ) : (
            <Card padding="p-0">
              <ul className="divide-y divide-neutral-100">
                {pending.map((r) => (
                  <RequestItem key={r.id} request={r} />
                ))}
              </ul>
            </Card>
          )}

          {reviewed.length > 0 && (
            <details className="group">
              <summary className="cursor-pointer list-none text-xs font-medium text-neutral-500 hover:text-neutral-900">
                <span className="inline-flex items-center gap-1">
                  <span className="transition-transform group-open:rotate-90">▸</span>
                  ตรวจสอบแล้ว ({reviewed.length})
                </span>
              </summary>
              <Card padding="p-0" className="mt-2">
                <ul className="divide-y divide-neutral-100">
                  {reviewed.map((r) => (
                    <RequestItem key={r.id} request={r} />
                  ))}
                </ul>
              </Card>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

function RequestItem({ request: r }: { request: RequestRow }) {
  const status = STATUS_BADGE[r.status];
  return (
    <li className="flex items-center justify-between gap-3 px-5 py-4 text-sm">
      <div className="min-w-0">
        <p className="truncate font-medium">{r.globalPlayer.name}</p>
        <p className="truncate text-xs text-neutral-500">{r.user.email}</p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <Badge variant={status.variant}>{status.label}</Badge>
        {r.status === "PENDING" && (
          <div className="flex gap-2">
            <form action={rejectLinkRequest}>
              <input type="hidden" name="requestId" value={r.id} />
              <Button type="submit" variant="secondary" size="sm">
                ปฏิเสธ
              </Button>
            </form>
            <form action={approveLinkRequest}>
              <input type="hidden" name="requestId" value={r.id} />
              <Button type="submit" variant="primary" size="sm">
                อนุมัติ
              </Button>
            </form>
          </div>
        )}
      </div>
    </li>
  );
}
