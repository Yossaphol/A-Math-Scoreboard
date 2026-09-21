import { redirect } from "next/navigation";
import { getSession } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { requestPlayerLink } from "@/lib/actions/link-requests";
import { logoutAction } from "@/lib/actions/auth";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button, LinkButton } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";

const REQUEST_STATUS_LABEL: Record<string, { label: string; variant: "warning" | "success" | "danger" }> = {
  PENDING: { label: "รอตรวจสอบ", variant: "warning" },
  APPROVED: { label: "อนุมัติแล้ว", variant: "success" },
  REJECTED: { label: "ถูกปฏิเสธ", variant: "danger" },
};

export default async function AccountPage(props: PageProps<"/account">) {
  const session = await getSession();
  if (!session?.user) redirect("/login?callbackUrl=/account");

  const { q } = await props.searchParams;
  const query = typeof q === "string" ? q.trim() : "";

  const [globalPlayer, myRequests] = await Promise.all([
    prisma.globalPlayer.findUnique({ where: { userId: session.user.id } }),
    prisma.linkRequest.findMany({
      where: { userId: session.user.id },
      include: { globalPlayer: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const searchResults =
    !globalPlayer && query
      ? await prisma.globalPlayer.findMany({
          where: { userId: null, name: { contains: query, mode: "insensitive" } },
          take: 10,
        })
      : [];

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <PageHeader
        title="บัญชีของฉัน"
        subtitle={session.user.email ?? undefined}
        actions={
          <form action={logoutAction}>
            <Button type="submit" variant="ghost" size="sm">
              ออกจากระบบ
            </Button>
          </form>
        }
      />

      {globalPlayer ? (
        <Card>
          <p className="text-xs text-neutral-500">Global Player</p>
          <p className="mt-1 text-lg font-semibold">{globalPlayer.name}</p>
          {globalPlayer.nickname && (
            <p className="text-sm text-neutral-500">{globalPlayer.nickname}</p>
          )}
          <p className="mt-2 text-xs text-neutral-400">Player ID: {globalPlayer.id}</p>
          <LinkButton href="/account/history" variant="secondary" size="sm" className="mt-4">
            ดูประวัติการแข่งขัน
          </LinkButton>
        </Card>
      ) : (
        <Card>
          <p className="text-sm font-medium">ยังไม่ได้ผูกบัญชีกับผู้เล่น</p>
          <p className="mt-1 text-xs text-neutral-500">
            ค้นหาชื่อผู้เล่นของคุณแล้วส่งคำขอผูกบัญชี — Admin จะตรวจสอบก่อนอนุมัติ
          </p>
          <form className="mt-4">
            <input
              type="search"
              name="q"
              defaultValue={query}
              placeholder="ค้นหาชื่อผู้เล่น..."
              className="w-full rounded-lg border border-neutral-200 bg-white/70 px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </form>

          {query && (
            <ul className="mt-4 divide-y divide-neutral-100">
              {searchResults.map((p) => (
                <li key={p.id} className="flex items-center justify-between py-2 text-sm">
                  <span>{p.name}</span>
                  <form action={requestPlayerLink}>
                    <input type="hidden" name="globalPlayerId" value={p.id} />
                    <Button type="submit" variant="secondary" size="sm">
                      ขอผูกบัญชี
                    </Button>
                  </form>
                </li>
              ))}
              {searchResults.length === 0 && (
                <li className="py-4 text-center text-xs text-neutral-500">ไม่พบผู้เล่นที่ตรงกับ &quot;{query}&quot;</li>
              )}
            </ul>
          )}
        </Card>
      )}

      {myRequests.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-2 text-xs font-medium text-neutral-500">คำขอผูกบัญชีของฉัน</h2>
          <Card padding="p-0">
            <ul className="divide-y divide-neutral-100">
              {myRequests.map((r) => {
                const status = REQUEST_STATUS_LABEL[r.status];
                return (
                  <li key={r.id} className="flex items-center justify-between px-4 py-3 text-sm">
                    <span>{r.globalPlayer.name}</span>
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>
      )}

      {!globalPlayer && myRequests.length === 0 && !query && (
        <div className="mt-6">
          <EmptyState title="ยังไม่มีคำขอผูกบัญชี" description="ค้นหาชื่อผู้เล่นด้านบนเพื่อเริ่มต้น" />
        </div>
      )}
    </main>
  );
}
