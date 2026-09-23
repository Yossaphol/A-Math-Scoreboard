import type { Prisma } from "@/generated/prisma/client";
import { requireAdmin } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import {
  unlinkGlobalPlayerAccount,
  deleteGlobalPlayerAccount,
  deleteGlobalPlayer,
  forceDeleteGlobalPlayer,
} from "@/lib/actions/global-players";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmSubmitButton } from "@/components/ui/ConfirmSubmitButton";
import { ActionMenu } from "@/components/ui/ActionMenu";
import { RenamePlayerForm } from "@/components/admin/RenamePlayerForm";
import { AddGlobalPlayerModal } from "@/components/admin/AddGlobalPlayerModal";
import { PageSizeSelect } from "@/components/ui/PageSizeSelect";
import { Pagination } from "@/components/ui/Pagination";
import { inputClass } from "@/components/ui/styles";

const DEFAULT_PAGE_SIZE = 20;

export default async function GlobalPlayersPage(props: PageProps<"/admin/players">) {
  await requireAdmin();
  const { q, page: pageParam, pageSize: pageSizeParam } = await props.searchParams;
  const query = typeof q === "string" ? q.trim() : "";
  const pageSize = Math.min(500, Math.max(1, Number(pageSizeParam) || DEFAULT_PAGE_SIZE));

  const where: Prisma.GlobalPlayerWhereInput | undefined = query
    ? {
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { nickname: { contains: query, mode: "insensitive" } },
        ],
      }
    : undefined;

  const totalCount = await prisma.globalPlayer.count({ where });
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const page = Math.min(Math.max(1, Number(pageParam) || 1), totalPages);

  const players = await prisma.globalPlayer.findMany({
    where,
    include: { user: true, _count: { select: { tournamentPlayers: true } } },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * pageSize,
    take: pageSize,
  });

  const buildHref = (targetPage: number) => {
    const sp = new URLSearchParams();
    if (query) sp.set("q", query);
    sp.set("pageSize", String(pageSize));
    sp.set("page", String(targetPage));
    return `/admin/players?${sp.toString()}`;
  };

  return (
    <div>
      <PageHeader title="Global Players" actions={<AddGlobalPlayerModal />} />

      <form className="mb-6 max-w-sm">
        {/* Reset to page 1 whenever the search itself changes. */}
        <input type="hidden" name="page" value="1" />
        <input type="hidden" name="pageSize" value={pageSize} />
        <input type="search" name="q" defaultValue={query} placeholder="ค้นหาผู้เล่น..." className={inputClass} />
      </form>

      {players.length === 0 ? (
        <EmptyState title="ไม่พบผู้เล่น" />
      ) : (
        <Card padding="p-0" className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200/70 text-left text-xs text-neutral-500">
                <th className="py-3 pl-5 pr-3">Global Player ID</th>
                <th className="py-3 pr-3">Name</th>
                <th className="py-3 pr-3">Linked Google Account</th>
                <th className="py-3 pr-3 text-right">Tournaments</th>
                <th className="py-3 pr-5 text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {players.map((p) => (
                <tr key={p.id} className="border-b border-neutral-100 last:border-0">
                  <td className="py-3 pl-5 pr-3 text-xs text-neutral-400">{p.id}</td>
                  <td className="py-3 pr-3">
                    <RenamePlayerForm globalPlayerId={p.id} name={p.name} nickname={p.nickname} />
                  </td>
                  <td className="py-3 pr-3 text-xs text-neutral-500">{p.user?.email ?? "—"}</td>
                  <td className="py-3 pr-3 text-right">{p._count.tournamentPlayers}</td>
                  <td className="py-3 pr-5 text-center">
                    <ActionMenu>
                      {p.user && (
                        <>
                          <form action={unlinkGlobalPlayerAccount}>
                            <input type="hidden" name="globalPlayerId" value={p.id} />
                            <ConfirmSubmitButton
                              label="ยกเลิกผูกบัญชี"
                              confirmTitle="ยกเลิกการผูกบัญชี Google?"
                              confirmMessage={`${p.user.email} จะไม่ผูกกับผู้เล่น "${p.name}" อีกต่อไป (บัญชียังใช้ Login ได้ตามปกติ)`}
                              variant="secondary"
                              className="w-full"
                            />
                          </form>
                          <form action={deleteGlobalPlayerAccount}>
                            <input type="hidden" name="globalPlayerId" value={p.id} />
                            <ConfirmSubmitButton
                              label="ลบบัญชี"
                              confirmTitle="ลบบัญชีผู้เล่นนี้?"
                              confirmMessage={`บัญชี ${p.user.email} จะถูกลบถาวร (ต้อง Login ใหม่หากจะใช้งานอีก) ทำได้เฉพาะบัญชีที่ยังไม่เคยเป็น Staff หรือสร้าง Tournament`}
                              className="w-full"
                            />
                          </form>
                        </>
                      )}
                      {p._count.tournamentPlayers > 0 ? (
                        <form action={forceDeleteGlobalPlayer}>
                          <input type="hidden" name="globalPlayerId" value={p.id} />
                          <ConfirmSubmitButton
                            label="ลบผู้เล่น"
                            confirmTitle={`ลบผู้เล่น "${p.name}" พร้อมประวัติการแข่งขันทั้งหมด?`}
                            confirmMessage={`ผู้เล่นนี้เคยลงแข่ง ${p._count.tournamentPlayers} Tournament — การลบจะลบทุก Match ที่เขาเคยเล่นไปด้วย ซึ่งจะลบแมตช์นั้นออกจากประวัติของคู่แข่งที่เคยเจอเขาด้วยเช่นกัน (แก้คืนไม่ได้)`}
                            className="w-full"
                          />
                        </form>
                      ) : (
                        <form action={deleteGlobalPlayer}>
                          <input type="hidden" name="globalPlayerId" value={p.id} />
                          <ConfirmSubmitButton
                            label="ลบผู้เล่น"
                            confirmTitle="ลบผู้เล่นนี้ออกจากระบบ?"
                            confirmMessage={`ผู้เล่น "${p.name}" (Global Player ID ${p.id}) จะถูกลบถาวร`}
                            className="w-full"
                          />
                        </form>
                      )}
                    </ActionMenu>
                  </td>
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
