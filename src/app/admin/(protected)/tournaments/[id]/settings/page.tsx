import { prisma } from "@/lib/prisma";
import { requireTournamentAccess } from "@/lib/dal";
import { updateTournamentStatus, updateTournamentLimits, deleteTournament } from "@/lib/actions/tournaments";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ConfirmSubmitButton } from "@/components/ui/ConfirmSubmitButton";
import { ToggleGroup } from "@/components/ui/ToggleGroup";
import { playerLimitOf, roundLimitOf } from "@/lib/tournament-limits";
import { inputClass, labelClass } from "@/components/ui/styles";

export default async function AdminSettingsPage(props: PageProps<"/admin/tournaments/[id]/settings">) {
  const { id } = await props.params;
  const user = await requireTournamentAccess(id);
  const tournament = await prisma.tournament.findUniqueOrThrow({ where: { id } });

  return (
    <div className="max-w-lg space-y-6">
      <Card>
        <h2 className="mb-3 text-sm font-medium text-neutral-900">Tournament Status</h2>
        <form action={updateTournamentStatus} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="tournamentId" value={id} />
          <div className="min-w-0 flex-1">
            <label className={labelClass}>สถานะปัจจุบัน</label>
            <select key={tournament.status} name="status" defaultValue={tournament.status} className={`${inputClass} mt-1`}>
              <option value="UPCOMING">เร็ว ๆ นี้ (กำลังเตรียม)</option>
              <option value="ONGOING">กำลังแข่งขัน</option>
              <option value="COMPLETED">จบแล้ว</option>
            </select>
          </div>
          <Button type="submit">บันทึก</Button>
        </form>
      </Card>

      <Card>
        <h2 className="mb-1 text-sm font-medium text-neutral-900">จำนวนผู้เล่นและจำนวนรอบ</h2>
        <p className="mb-4 text-xs text-neutral-500">
          ผู้เล่น Active ครบแล้วจะเพิ่มผู้เล่นไม่ได้ · แข่งครบจำนวนรอบแล้ว Tournament จะจบอัตโนมัติ ·
          ตั้งน้อยกว่าผู้เล่น Active หรือจำนวนรอบที่สร้างไปแล้วไม่ได้
        </p>
        <form action={updateTournamentLimits} className="space-y-4">
          <input type="hidden" name="tournamentId" value={id} />
          <ToggleGroup name="setPlayerLimit" label="กำหนดจำนวนผู้เล่น" defaultChecked={playerLimitOf(tournament) != null}>
            <label className={labelClass}>จำนวนผู้เล่น</label>
            <input
              name="maxPlayers"
              type="number"
              min={1}
              required
              defaultValue={tournament.maxPlayers ?? 24}
              className={`${inputClass} mt-1`}
            />
          </ToggleGroup>
          <ToggleGroup name="setNumberOfGames" label="กำหนดจำนวนรอบการแข่งขัน" defaultChecked={roundLimitOf(tournament) != null}>
            <label className={labelClass}>จำนวนรอบการแข่งขัน</label>
            <input
              name="numberOfGames"
              type="number"
              min={1}
              required
              defaultValue={tournament.numberOfGames ?? 6}
              className={`${inputClass} mt-1`}
            />
          </ToggleGroup>
          <div className="flex justify-end">
            <Button type="submit">บันทึก</Button>
          </div>
        </form>
      </Card>

      <Card>
        <p className="mb-4 text-xs text-neutral-500">
          Setting อื่น ๆ ยังแก้หลังสร้าง Tournament ไม่ได้ — แสดงค่าปัจจุบันแบบ read-only
        </p>
        <dl className="grid grid-cols-2 gap-y-4 text-sm">
          <dt className="text-neutral-500">Mode</dt>
          <dd className="font-medium text-neutral-900">{tournament.mode}</dd>
          <dt className="text-neutral-500">First / Second</dt>
          <dd className="font-medium text-neutral-900">{tournament.useFirstSecond ? "On" : "Off"}</dd>
          <dt className="text-neutral-500">Default Maximum Score</dt>
          <dd className="font-medium text-neutral-900">{tournament.defaultMaximumScore ?? "—"}</dd>
          {tournament.pinCode && (
            <>
              <dt className="text-neutral-500">Practice PIN</dt>
              <dd className="font-medium text-neutral-900">{tournament.pinCode}</dd>
            </>
          )}
        </dl>
      </Card>

      {user.role === "ADMIN" && (
        <Card className="border-danger/30 !bg-danger/5">
          <h2 className="mb-1 text-sm font-medium text-danger">Danger Zone</h2>
          <p className="mb-4 text-xs text-neutral-600">
            ลบ Tournament นี้ทิ้งทั้งหมด — Player, Round, Match, Table และผลการแข่งขันทุก Round
            จะหายไปถาวร กู้คืนไม่ได้
          </p>
          <form action={deleteTournament}>
            <input type="hidden" name="tournamentId" value={id} />
            <ConfirmSubmitButton
              label="ลบ Tournament"
              confirmTitle={`ลบ "${tournament.name}" ถาวร?`}
              confirmMessage="ข้อมูลผู้เล่น การจับคู่ และผลการแข่งขันทั้งหมดของ Tournament นี้จะถูกลบทิ้งถาวร กู้คืนไม่ได้"
            />
          </form>
        </Card>
      )}
    </div>
  );
}
