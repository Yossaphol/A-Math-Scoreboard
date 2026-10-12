import { prisma } from "@/lib/prisma";
import { requireTournamentAccess } from "@/lib/dal";
import {
  updateTournamentStatus,
  updateTournamentGeneral,
  updateTournamentLimits,
  deleteTournament,
} from "@/lib/actions/tournaments";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ConfirmSubmitButton } from "@/components/ui/ConfirmSubmitButton";
import { Switch } from "@/components/ui/Switch";
import { ToggleGroup } from "@/components/ui/ToggleGroup";
import { playerLimitOf, roundLimitOf } from "@/lib/tournament-limits";
import { inputClass, labelClass } from "@/components/ui/styles";

const MODE_LABEL: Record<string, string> = {
  COMPETITION: "การแข่งขันจริง",
  PRACTICE: "โหมดฝึกซ้อม",
};

export default async function AdminSettingsPage(props: PageProps<"/admin/tournaments/[id]/settings">) {
  const { id } = await props.params;
  const user = await requireTournamentAccess(id);
  const tournament = await prisma.tournament.findUniqueOrThrow({ where: { id } });

  return (
    <div className="max-w-lg space-y-6">
      <Card>
        <SectionTitle title="สถานะ Tournament" />
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
        {/* Mirrors confirmPairing / maybeCompleteRound / deleteRound, so nobody flips it by hand needlessly. */}
        <ul className="mt-3 list-disc space-y-0.5 pl-4 text-xs text-neutral-500">
          <li>ระบบเปลี่ยนเป็น &quot;กำลังแข่งขัน&quot; ให้เองเมื่อ Confirm Round แรก</li>
          <li>ถ้ากำหนดจำนวนรอบไว้ ระบบเปลี่ยนเป็น &quot;จบแล้ว&quot; ให้เองเมื่อรอบสุดท้ายยืนยันผลครบ</li>
          <li>เปลี่ยนเองได้ตลอด เช่น จบการแข่งขันก่อนครบรอบ</li>
        </ul>
      </Card>

      <Card>
        <SectionTitle
          title="ข้อมูลทั่วไป"
          hint="First/Second และคะแนนสูงสุดเริ่มต้นมีผลกับ Round ที่สร้างหลังจากนี้ — Round ที่สร้างไปแล้วไม่เปลี่ยน"
        />
        <form action={updateTournamentGeneral} className="space-y-4">
          <input type="hidden" name="tournamentId" value={id} />
          <div>
            <label className={labelClass}>ชื่อ Tournament</label>
            <input
              name="name"
              required
              minLength={2}
              defaultValue={tournament.name}
              className={`${inputClass} mt-1`}
            />
          </div>
          <div className="rounded-xl border border-neutral-200 bg-white/40 p-4">
            <Switch
              name="useFirstSecond"
              label="เปิดใช้ระบบเริ่มก่อน-หลัง (First/Second)"
              defaultChecked={tournament.useFirstSecond}
            />
          </div>
          <div>
            <label className={labelClass}>คะแนนสูงสุดเริ่มต้นต่อเกม (แก้หรือปิดได้ทีละ Round ตอนสร้าง Round)</label>
            <input
              name="defaultMaximumScore"
              type="number"
              min={1}
              required
              defaultValue={tournament.defaultMaximumScore ?? 350}
              className={`${inputClass} mt-1`}
            />
          </div>
          <div className="flex justify-end">
            <Button type="submit">บันทึก</Button>
          </div>
        </form>
      </Card>

      <Card>
        <SectionTitle
          title="จำนวนผู้เล่นและจำนวนรอบ"
          hint="ผู้เล่น Active ครบแล้วจะเพิ่มผู้เล่นไม่ได้ · แข่งครบจำนวนรอบแล้ว Tournament จะจบอัตโนมัติ · ตั้งน้อยกว่าผู้เล่น Active หรือจำนวนรอบที่สร้างไปแล้วไม่ได้"
        />
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
        <SectionTitle title="แก้ไขไม่ได้หลังสร้าง" />
        <dl className="grid grid-cols-2 gap-y-3 text-sm">
          <dt className="text-neutral-500">โหมด</dt>
          <dd className="font-medium text-neutral-900">{MODE_LABEL[tournament.mode] ?? tournament.mode}</dd>
          {tournament.pinCode && (
            <>
              <dt className="text-neutral-500">รหัสผ่านหน้าฝึกซ้อม</dt>
              <dd className="font-mono font-medium tracking-widest text-neutral-900">{tournament.pinCode}</dd>
            </>
          )}
        </dl>
        <p className="mt-3 text-xs text-neutral-400">
          เปลี่ยนโหมดไม่ได้ เพราะรหัสผ่านและลิงก์กรอกผลเองมีเฉพาะโหมดฝึกซ้อม — ถ้าเลือกผิด ให้สร้าง Tournament ใหม่
        </p>
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

function SectionTitle({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-sm font-medium text-neutral-900">{title}</h2>
      {hint && <p className="mt-1 text-xs text-neutral-500">{hint}</p>}
    </div>
  );
}
