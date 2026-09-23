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
import Link from "next/link";
import {
  BulkActionBar,
  BulkSelectProvider,
  RowCheckbox,
  SelectAllCheckbox,
} from "@/components/admin/BulkSelect";

const DEFAULT_PAGE_SIZE = 20;

type SortKey = "name" | "account" | "tournaments";
type SortDir = "asc" | "desc";
const SORT_KEYS: SortKey[] = ["name", "account", "tournaments"];
// First click on a column: A→Z for text, most-first for the tournament count.
const FIRST_DIR: Record<SortKey, SortDir> = { name: "asc", account: "asc", tournaments: "desc" };

// Sorting happens in the database (not on the current page only), so it stays correct across
// pagination. The id tiebreak keeps page boundaries stable when many rows share a value.
function orderByFor(sort: SortKey | null, dir: SortDir): Prisma.GlobalPlayerOrderByWithRelationInput[] {
  switch (sort) {
    case "name":
      return [{ name: dir }, { id: "asc" }];
    case "account":
      return [{ user: { email: dir } }, { id: "asc" }];
    case "tournaments":
      return [{ tournamentPlayers: { _count: dir } }, { id: "asc" }];
    default:
      return [{ createdAt: "desc" }, { id: "asc" }];
  }
}

export default async function GlobalPlayersPage(props: PageProps<"/admin/players">) {
  await requireAdmin();
  const {
    q,
    page: pageParam,
    pageSize: pageSizeParam,
    sort: sortParam,
    dir: dirParam,
  } = await props.searchParams;
  const query = typeof q === "string" ? q.trim() : "";
  const pageSize = Math.min(500, Math.max(1, Number(pageSizeParam) || DEFAULT_PAGE_SIZE));
  const sort = SORT_KEYS.includes(sortParam as SortKey) ? (sortParam as SortKey) : null;
  const dir: SortDir = dirParam === "desc" ? "desc" : dirParam === "asc" ? "asc" : sort ? FIRST_DIR[sort] : "desc";

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
    orderBy: orderByFor(sort, dir),
    skip: (page - 1) * pageSize,
    take: pageSize,
  });

  const buildHref = (targetPage: number, override?: { sort: SortKey; dir: SortDir }) => {
    const sp = new URLSearchParams();
    if (query) sp.set("q", query);
    sp.set("pageSize", String(pageSize));
    sp.set("page", String(targetPage));
    const s = override ?? (sort ? { sort, dir } : null);
    if (s) {
      sp.set("sort", s.sort);
      sp.set("dir", s.dir);
    }
    return `/admin/players?${sp.toString()}`;
  };
  // Clicking the active column flips direction; a new column starts at its natural direction.
  // Either way back to page 1, since the old page number means something else in a new order.
  const sortHref = (key: SortKey) =>
    buildHref(1, { sort: key, dir: sort === key ? (dir === "asc" ? "desc" : "asc") : FIRST_DIR[key] });
  const sortState = (key: SortKey) => (sort === key ? dir : null);

  return (
    <div>
      <PageHeader title="Global Players" actions={<AddGlobalPlayerModal />} />

      <form className="mb-6 max-w-sm">
        {/* Reset to page 1 whenever the search itself changes. */}
        <input type="hidden" name="page" value="1" />
        <input type="hidden" name="pageSize" value={pageSize} />
        {sort && (
          <>
            <input type="hidden" name="sort" value={sort} />
            <input type="hidden" name="dir" value={dir} />
          </>
        )}
        <input type="search" name="q" defaultValue={query} placeholder="ค้นหาผู้เล่น..." className={inputClass} />
      </form>

      {players.length === 0 ? (
        <EmptyState title="ไม่พบผู้เล่น" />
      ) : (
        <BulkSelectProvider
          rows={players.map((p) => ({ id: p.id, name: p.name, tournamentCount: p._count.tournamentPlayers }))}
        >
        <BulkActionBar />
        <Card padding="p-0" className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200/70 text-left text-xs text-neutral-500">
                <th className="w-10 py-3 pl-5 pr-2">
                  <SelectAllCheckbox />
                </th>
                <th className="py-3 pr-3">Global Player ID</th>
                <th className="py-3 pr-3">
                  <SortHeader href={sortHref("name")} state={sortState("name")}>
                    Name
                  </SortHeader>
                </th>
                <th className="py-3 pr-3">
                  <SortHeader href={sortHref("account")} state={sortState("account")}>
                    Linked Google Account
                  </SortHeader>
                </th>
                <th className="py-3 pr-3 text-right">
                  <SortHeader href={sortHref("tournaments")} state={sortState("tournaments")} align="right">
                    Tournaments
                  </SortHeader>
                </th>
                <th className="py-3 pr-5 text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {players.map((p) => (
                <tr key={p.id} className="border-b border-neutral-100 last:border-0">
                  <td className="py-3 pl-5 pr-2">
                    <RowCheckbox id={p.id} name={p.name} />
                  </td>
                  <td className="py-3 pr-3 text-xs text-neutral-400">{p.id}</td>
                  <td className="py-3 pr-3">
                    {p.name}
                    {p.nickname && <span className="ml-2 text-xs text-neutral-500">{p.nickname}</span>}
                  </td>
                  <td className="py-3 pr-3 text-xs text-neutral-500">{p.user?.email ?? "—"}</td>
                  <td className="py-3 pr-3 text-right">{p._count.tournamentPlayers}</td>
                  <td className="py-3 pr-5 text-center">
                    <ActionMenu>
                      <RenamePlayerForm globalPlayerId={p.id} name={p.name} nickname={p.nickname} />
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
        </BulkSelectProvider>
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

      <p className="mt-6 text-xs text-neutral-400">
        หมายเหตุ: <span className="font-medium">ยกเลิกผูกบัญชี</span> แค่ตัดการเชื่อมระหว่างบัญชี Google
        กับผู้เล่นคนนี้ — บัญชียังใช้ Login ได้ตามปกติ ใช้ตอนผูกผิดคนแล้วอยากให้ไปผูกกับผู้เล่นที่ถูกต้องแทน
        ส่วน <span className="font-medium">ลบบัญชี</span> คือลบบัญชี Login ทิ้งถาวร (ต้อง Login ใหม่ถ้าจะใช้อีก)
        ใช้ตอนเป็นบัญชีสแปมหรือผูกผิดโดยไม่ตั้งใจและอยากล้างทิ้งไปเลย — ทำได้เฉพาะบัญชีที่ยังไม่เคยเป็น Staff
        หรือสร้าง Tournament มาก่อน
      </p>
    </div>
  );
}

// Column header that sorts the table by that column — the arrow shows the active direction;
// inactive columns show a faint ↕ so it's discoverable that they're clickable.
function SortHeader({
  href,
  state,
  align = "left",
  children,
}: {
  href: string;
  state: "asc" | "desc" | null;
  align?: "left" | "right";
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-1 hover:text-neutral-900 ${state ? "text-neutral-900" : ""} ${
        align === "right" ? "flex-row-reverse" : ""
      }`}
      aria-sort={state === "asc" ? "ascending" : state === "desc" ? "descending" : undefined}
    >
      {children}
      <span aria-hidden className={state ? "" : "text-neutral-300"}>
        {state === "asc" ? "▲" : state === "desc" ? "▼" : "↕"}
      </span>
    </Link>
  );
}
