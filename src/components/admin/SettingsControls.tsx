"use client";

import { useState, useTransition } from "react";
import { Switch } from "@/components/ui/Switch";
import { Button } from "@/components/ui/Button";
import {
  setRefereeSoundMuted,
  setResultPopupsHidden,
  useRefereeSoundMuted,
  useResultPopupsHidden,
} from "@/components/ui/alerts/device-prefs";
import { playAlertChime, unlockAudio } from "@/components/ui/alerts/sound";
import { setLiveFeedEnabled } from "@/lib/actions/system-settings";

/** "เครื่องนี้" rows — saved in this browser right away, no Save button. */
export function DeviceSettings({ liveFeedEnabled }: { liveFeedEnabled: boolean }) {
  const soundMuted = useRefereeSoundMuted();
  const popupsHidden = useResultPopupsHidden();
  const offHint = liveFeedEnabled ? null : " · ตอนนี้ระบบแจ้งเตือนสดปิดอยู่ จึงยังไม่มีผล";

  return (
    <>
      <SettingRow>
        <Switch
          label="เสียงเรียกกรรมการ"
          checked={!soundMuted}
          onChange={(on) => setRefereeSoundMuted(!on)}
          description={
            <>
              {soundMuted
                ? "ปิดเสียงอยู่ — ยังเห็น popup เรียกกรรมการตามปกติ"
                : "ดังซ้ำจนกว่าจะกดรับเรื่องหรือปิด popup"}
              {offHint}
            </>
          }
        />
        {!soundMuted && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="mt-3"
            onClick={() => {
              unlockAudio();
              playAlertChime();
            }}
          >
            ทดสอบเสียง
          </Button>
        )}
      </SettingRow>
      <SettingRow>
        <Switch
          label="Popup ผลการแข่ง"
          checked={!popupsHidden}
          onChange={(on) => setResultPopupsHidden(!on)}
          description={
            <>
              {popupsHidden
                ? "ไม่เด้ง popup มุมขวาบน — ยังดูย้อนหลังได้ที่กระดิ่ง"
                : "เด้ง popup มุมขวาบนทุกครั้งที่มีผลเข้ามา"}
              <span className="block">
                ครอบคลุม: ผลที่ผู้เล่นยืนยันที่โต๊ะ (ยืนยันผล / ผลไม่ตรงกัน / ผลเสมอ) และผลที่ Admin/Staff บันทึกเอง
              </span>
              <span className="block text-neutral-400">Popup เรียกกรรมการและข้อผิดพลาดจะแสดงเสมอ</span>
            </>
          }
        />
      </SettingRow>
    </>
  );
}

/** System-wide live feed. Turning it off mid-event silences every screen, so it asks first. */
export function LiveFeedSetting({ enabled }: { enabled: boolean }) {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  function save(next: boolean) {
    const fd = new FormData();
    fd.set("enabled", next ? "1" : "0");
    startTransition(() => setLiveFeedEnabled(fd));
  }

  return (
    <SettingRow>
      <Switch
        label="ระบบแจ้งเตือนสด"
        checked={enabled}
        disabled={pending}
        onChange={(on) => (on ? save(true) : setConfirming(true))}
        description={
          enabled
            ? "เรียกกรรมการจากโต๊ะ, แจ้งผลจากโต๊ะ และรายชื่อทีมงานที่ออนไลน์ ทำงานอยู่บนทุกจอ Admin/Staff"
            : "ปิดอยู่ — ไม่มีปุ่มเรียกกรรมการที่หน้าโต๊ะ และไม่มีแจ้งเตือนสด (กรอกและยืนยันผลที่โต๊ะยังใช้ได้) อย่าลืมเปิดก่อนเริ่มแข่ง"
        }
      />
      <details className="mt-3 text-xs text-neutral-500">
        <summary className="cursor-pointer select-none font-medium text-neutral-600 hover:text-neutral-900">
          ทำงานอย่างไร
        </summary>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>เปิดอยู่: ทุกจอ Admin/Staff ที่เปิดไว้จะเช็กกับ database ทุกวินาที</li>
          <li>แท็บที่ไม่ได้อยู่บนจอเกิน 10 นาทีจะหยุดเอง และกลับมาทำงานทันทีเมื่อเปิดแท็บนั้น</li>
          <li>ปิดเมื่อไม่มีการแข่งเพื่อไม่ให้เปลือง database — จอที่เปิดค้างไว้จะหยุดภายใน 30 วินาที</li>
        </ul>
      </details>

      {confirming && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="ปิดระบบแจ้งเตือนสด?"
        >
          <div className="surface w-full max-w-sm rounded-2xl p-6">
            <p className="text-sm font-semibold text-neutral-900">ปิดระบบแจ้งเตือนสด?</p>
            <p className="mt-1.5 text-sm text-neutral-600">
              ทุกจอจะหยุดรับการเรียกกรรมการและแจ้งผลจากโต๊ะ และหน้าโต๊ะจะไม่มีปุ่มเรียกกรรมการ — ถ้ากำลังแข่งอยู่ไม่ควรปิด
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" autoFocus onClick={() => setConfirming(false)}>
                ยกเลิก
              </Button>
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={() => {
                  setConfirming(false);
                  save(false);
                }}
              >
                ปิดระบบ
              </Button>
            </div>
          </div>
        </div>
      )}
    </SettingRow>
  );
}

function SettingRow({ children }: { children: React.ReactNode }) {
  return <div className="px-5 py-4">{children}</div>;
}
