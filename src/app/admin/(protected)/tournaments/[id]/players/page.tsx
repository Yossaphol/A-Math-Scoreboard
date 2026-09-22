import { prisma } from "@/lib/prisma";
import {
  addPlayerToTournament,
  removePlayerFromTournament,
  withdrawPlayer,
  reactivatePlayer,
  importPlayersToTournament,
} from "@/lib/actions/players";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ConfirmSubmitButton } from "@/components/ui/ConfirmSubmitButton";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { inputClass, labelClass } from "@/components/ui/styles";
import { PLAYER_STATUS_BADGE } from "@/lib/status-labels";

export default async function TournamentPlayersPage(
  props: PageProps<"/admin/tournaments/[id]/players">
) {
  const { id } = await props.params;
  const { playerQuery } = await props.searchParams;
  const query = typeof playerQuery === "string" ? playerQuery.trim() : "";

  const [tournament, players] = await Promise.all([
    prisma.tournament.findUniqueOrThrow({ where: { id } }),
    prisma.tournamentPlayer.findMany({
      where: { tournamentId: id },
      include: { globalPlayer: true },
      orderBy: { tournamentPlayerNo: "asc" },
    }),
  ]);

  const alreadyInTournament = new Set(players.map((p) => p.globalPlayerId));
  const queryAsId = Number(query);
  const searchResults = query
    ? await prisma.globalPlayer.findMany({
        where: {
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { nickname: { contains: query, mode: "insensitive" } },
            ...(Number.isInteger(queryAsId) ? [{ id: queryAsId }] : []),
          ],
        },
        take: 10,
        orderBy: { name: "asc" },
      })
    : [];

  return (
    <div>
      <Card>
        <h2 className="mb-3 text-sm font-medium text-neutral-900">ค้นหาผู้เล่นที่มีอยู่แล้ว</h2>
        <form className="flex items-end gap-3">
          <input type="hidden" name="tab" value="players" />
          <div className="flex-1">
            <input
              type="search"
              name="playerQuery"
              defaultValue={query}
              placeholder="ค้นหาด้วยชื่อ, Nickname หรือ Global Player ID..."
              className={inputClass}
            />
          </div>
        </form>

        {query && (
          <ul className="mt-3 divide-y divide-neutral-100">
            {searchResults.map((gp) => {
              const already = alreadyInTournament.has(gp.id);
              return (
                <li key={gp.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <div className="min-w-0 truncate">
                    <span className="font-medium">{gp.name}</span>
                    {gp.nickname && <span className="ml-2 text-xs text-neutral-500">{gp.nickname}</span>}
                    <span className="ml-2 text-xs text-neutral-400">#{gp.id}</span>
                  </div>
                  {already ? (
                    <Badge variant="neutral" className="shrink-0">
                      อยู่ใน Tournament นี้แล้ว
                    </Badge>
                  ) : (
                    <form action={addPlayerToTournament} className="shrink-0">
                      <input type="hidden" name="tournamentId" value={id} />
                      <input type="hidden" name="globalPlayerId" value={gp.id} />
                      <Button type="submit" variant="secondary" size="sm">
                        + เพิ่มเข้า Tournament
                      </Button>
                    </form>
                  )}
                </li>
              );
            })}
            {searchResults.length === 0 && (
              <li className="py-4 text-center text-xs text-neutral-500">
                ไม่พบผู้เล่นที่ตรงกับ &quot;{query}&quot; — สร้างใหม่ได้ด้านล่าง
              </li>
            )}
          </ul>
        )}
      </Card>

      <Card className="mt-6">
        <h2 className="mb-3 text-sm font-medium text-neutral-900">เพิ่มผู้เล่นใหม่</h2>
        <form action={addPlayerToTournament} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="tournamentId" value={id} />
          <div>
            <label className={labelClass}>ชื่อ</label>
            <input name="name" required className={`${inputClass} mt-1`} />
          </div>
          <div>
            <label className={labelClass}>Nickname (ถ้ามี)</label>
            <input name="nickname" className={`${inputClass} mt-1`} />
          </div>
          <Button type="submit">+ Add Player</Button>
        </form>
      </Card>

      <Card className="mt-6">
        <h2 className="text-sm font-medium text-neutral-900">นำเข้าผู้เล่นจากไฟล์</h2>
        <p className="mt-1 text-xs text-neutral-500">
          รองรับ .csv, .xlsx, .json — คอลัมน์ที่รองรับ: <code>name</code>, <code>nickname</code> (ไม่บังคับ),{" "}
          <code>globalPlayerId</code> (ไม่บังคับ — ถ้าใส่จะใช้ผู้เล่นที่มีอยู่แล้วตาม ID นั้นทันที) ผู้เล่นที่ชื่อตรงกับ
          ที่มีอยู่แล้วในระบบจะถูกใช้ซ้ำ ไม่สร้างใหม่ซ้ำซ้อน
        </p>
        <form action={importPlayersToTournament} className="mt-3 flex flex-wrap items-end gap-3">
          <input type="hidden" name="tournamentId" value={id} />
          <input
            type="file"
            name="file"
            accept=".csv,.xlsx,.xls,.json"
            required
            className={`${inputClass} max-w-xs`}
          />
          <Button type="submit" variant="secondary">
            นำเข้าผู้เล่น
          </Button>
        </form>
      </Card>

      <Card padding="p-0" className="mt-6 overflow-x-auto">
        {players.length === 0 ? (
          <div className="p-6">
            <EmptyState title="ยังไม่มีผู้เล่น" />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200/70 text-left text-xs text-neutral-500">
                <th className="py-3 pl-5 pr-3">#</th>
                <th className="py-3 pr-3">Name</th>
                <th className="py-3 pr-3">Global Player ID</th>
                <th className="py-3 pr-3">Status</th>
                <th className="py-3 pr-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {players.map((p) => {
                const status = PLAYER_STATUS_BADGE[p.status];
                return (
                  <tr key={p.id} className="border-b border-neutral-100 last:border-0">
                    <td className="py-3 pl-5 pr-3 text-neutral-500">{p.tournamentPlayerNo}</td>
                    <td className="py-3 pr-3">{p.globalPlayer.name}</td>
                    <td className="py-3 pr-3 text-xs text-neutral-400">#{p.globalPlayerId}</td>
                    <td className="py-3 pr-3">
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </td>
                    <td className="py-3 pr-5 text-right">
                      <div className="flex justify-end gap-2">
                        {p.status === "ACTIVE" ? (
                          <form action={withdrawPlayer}>
                            <input type="hidden" name="tournamentPlayerId" value={p.id} />
                            <ConfirmSubmitButton
                              label="Withdraw"
                              variant="secondary"
                              confirmTitle="Withdraw ผู้เล่น?"
                              confirmMessage={`${p.globalPlayer.name} จะไม่ถูกจับคู่ใน Round ถัดไป แต่ประวัติเดิมยังอยู่ (Withdraw ≠ Delete)`}
                            />
                          </form>
                        ) : (
                          <form action={reactivatePlayer}>
                            <input type="hidden" name="tournamentPlayerId" value={p.id} />
                            <Button type="submit" variant="secondary" size="sm">
                              Reactivate
                            </Button>
                          </form>
                        )}
                        {tournament.status === "UPCOMING" && (
                          <form action={removePlayerFromTournament}>
                            <input type="hidden" name="tournamentPlayerId" value={p.id} />
                            <ConfirmSubmitButton
                              label="Remove"
                              confirmTitle="ลบผู้เล่นออกจาก Tournament?"
                              confirmMessage={`${p.globalPlayer.name} จะถูกลบออกทั้งหมด — ใช้เมื่อ Import ผิดหรือผู้เล่นไม่เข้าร่วมเท่านั้น`}
                            />
                          </form>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
