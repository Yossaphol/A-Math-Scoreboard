import { requireAdmin } from "@/lib/dal";
import { getSystemSettings } from "@/lib/system-settings";
import { setLiveFeedEnabled } from "@/lib/actions/system-settings";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

export default async function SystemSettingsPage() {
  await requireAdmin();
  const { liveFeedEnabled } = await getSystemSettings();

  return (
    <div className="max-w-lg">
      <PageHeader title="ตั้งค่าระบบ" subtitle="มีผลกับทุก Tournament และทุกเครื่อง" />

      <Card>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-sm font-medium text-neutral-900">ระบบแจ้งเตือนสด</h2>
            <p className="mt-1 text-xs text-neutral-500">
              เรียกกรรมการจากโต๊ะ, แจ้งผลที่ผู้เล่นยืนยันหรือผลไม่ตรงกัน และรายชื่อกรรมการที่ออนไลน์
            </p>
          </div>
          <Badge variant={liveFeedEnabled ? "success" : "neutral"}>{liveFeedEnabled ? "เปิดอยู่" : "ปิดอยู่"}</Badge>
        </div>

        <ul className="mt-4 list-disc space-y-1 pl-5 text-xs text-neutral-600">
          {liveFeedEnabled ? (
            <>
              <li>ทุกจอ Admin/Staff ที่เปิดอยู่จะเช็กกับ database ทุกวินาที</li>
              <li>แท็บที่ไม่ได้อยู่บนจอเกิน 10 นาทีจะหยุดเอง และกลับมาทำงานทันทีเมื่อเปิดแท็บนั้น</li>
              <li>ปิดได้เมื่อไม่มีการแข่ง — จอที่เปิดค้างไว้จะหยุดภายในไม่เกิน 30 วินาที</li>
            </>
          ) : (
            <>
              <li>ไม่มีจอไหนเช็กกับ database — ไม่เปลือง database ระหว่างที่ไม่มีการแข่ง</li>
              <li>หน้าโต๊ะ (QR) จะไม่มีปุ่ม &quot;เรียกกรรมการ&quot;</li>
              <li>การกรอกผลและยืนยันผลที่โต๊ะยังใช้ได้ตามปกติ</li>
              <li>อย่าลืมเปิดก่อนเริ่มแข่ง</li>
            </>
          )}
        </ul>

        <form action={setLiveFeedEnabled} className="mt-5 flex justify-end">
          <input type="hidden" name="enabled" value={liveFeedEnabled ? "0" : "1"} />
          <Button type="submit" variant={liveFeedEnabled ? "secondary" : "primary"}>
            {liveFeedEnabled ? "ปิดระบบแจ้งเตือนสด" : "เปิดระบบแจ้งเตือนสด"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
