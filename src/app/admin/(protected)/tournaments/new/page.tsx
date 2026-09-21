import { requireAdmin } from "@/lib/dal";
import { createTournament } from "@/lib/actions/tournaments";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Switch } from "@/components/ui/Switch";
import { ToggleGroup } from "@/components/ui/ToggleGroup";
import { ModeAndPinFields } from "@/components/ui/ModeAndPinFields";
import { inputClass, labelClass } from "@/components/ui/styles";

export default async function NewTournamentPage() {
  await requireAdmin();

  return (
    <div className="max-w-lg">
      <PageHeader title="สร้าง Tournament" />

      <Card>
        <form action={createTournament} className="space-y-6">
          <Field label="ชื่อ Tournament">
            <input name="name" required className={inputClass} />
          </Field>

          <ModeAndPinFields />

          {/* Spec §7: player-limit and game-count toggles must stay independent. */}
          <ToggleGroup name="setPlayerLimit" label="กำหนดจำนวนผู้เล่นล่วงหน้า" defaultChecked>
            <Field label="จำนวนผู้เล่น">
              <input name="maxPlayers" type="number" min={2} defaultValue={24} className={inputClass} />
            </Field>
          </ToggleGroup>

          <ToggleGroup name="setNumberOfGames" label="กำหนดจำนวนรอบการแข่งขันล่วงหน้า" defaultChecked>
            <Field label="จำนวนรอบการแข่งขัน">
              <input name="numberOfGames" type="number" min={1} defaultValue={6} className={inputClass} />
            </Field>
          </ToggleGroup>

          <div className="rounded-xl border border-neutral-200 bg-white/40 p-4">
            <Switch name="useFirstSecond" label="เปิดใช้ระบบเริ่มก่อน-หลัง (First/Second)" defaultChecked />
          </div>

          <Field label="คะแนนสูงสุดเริ่มต้นต่อเกม (ตั้งค่าเริ่มต้นของเกมใหม่ แก้ไขหรือปิดทีหลังได้ต่อเกม)">
            <input
              name="defaultMaximumScore"
              type="number"
              min={1}
              defaultValue={350}
              className={inputClass}
            />
          </Field>

          <Button type="submit" className="w-full">
            สร้าง Tournament
          </Button>
        </form>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

