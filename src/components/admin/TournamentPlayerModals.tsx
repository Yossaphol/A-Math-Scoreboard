"use client";

import { useState } from "react";
import { addPlayerToTournament, importPlayersToTournament } from "@/lib/actions/players";
import { Button } from "@/components/ui/Button";
import { inputClass, labelClass } from "@/components/ui/styles";

/** Shared modal shell — same look as AddGlobalPlayerModal / NewRoundModal. */
function ModalShell({
  title,
  maxWidth = "max-w-sm",
  children,
}: {
  title: string;
  maxWidth?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm px-4"
      role="dialog"
      aria-modal="true"
    >
      <div className={`surface max-h-[90vh] w-full ${maxWidth} overflow-y-auto rounded-2xl p-6`}>
        <p className="text-sm font-semibold text-neutral-900">{title}</p>
        {children}
      </div>
    </div>
  );
}

function CancelButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-black/5"
    >
      ยกเลิก
    </button>
  );
}

/** Create a brand-new Global Player and add them to this Tournament in one step. */
export function AddTournamentPlayerModal({ tournamentId }: { tournamentId: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)} className="shrink-0">
        + เพิ่มผู้เล่นใหม่
      </Button>

      {open && (
        <ModalShell title="เพิ่มผู้เล่นใหม่">
          <form
            action={async (formData) => {
              await addPlayerToTournament(formData);
              setOpen(false);
            }}
            className="mt-4 space-y-4"
          >
            <input type="hidden" name="tournamentId" value={tournamentId} />
            <div>
              <label className={labelClass}>ชื่อ</label>
              <input name="name" required autoFocus className={`${inputClass} mt-1`} />
            </div>
            <div>
              <label className={labelClass}>Nickname (ถ้ามี)</label>
              <input name="nickname" className={`${inputClass} mt-1`} />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <CancelButton onClick={() => setOpen(false)} />
              <Button type="submit" size="sm">
                + Add Player
              </Button>
            </div>
          </form>
        </ModalShell>
      )}
    </>
  );
}

/** Bulk import from .csv/.xlsx/.json — the column rules live here instead of on the page. */
export function ImportPlayersModal({ tournamentId }: { tournamentId: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" variant="secondary" onClick={() => setOpen(true)} className="shrink-0">
        นำเข้าจากไฟล์
      </Button>

      {open && (
        <ModalShell title="นำเข้าผู้เล่นจากไฟล์" maxWidth="max-w-lg">
          <div className="mt-2 space-y-1.5 text-xs text-neutral-500">
            <p>รองรับไฟล์ .csv, .xlsx/.xls หรือ .json เท่านั้น</p>
            <p>ชื่อคอลัมน์ที่ระบบรู้จัก (พิมพ์เล็ก/ใหญ่ไม่มีผล):</p>
            <ul className="list-disc space-y-0.5 pl-4">
              <li>
                <code>name</code> หรือ <code>ชื่อ</code> — <strong>ต้องมี</strong> (ถ้าไม่ใส่ Global Player ID)
              </li>
              <li>
                <code>nickname</code> หรือ <code>ชื่อเล่น</code> — ไม่บังคับ
              </li>
              <li>
                <code>globalPlayerId</code> / <code>id</code> / <code>รหัส</code> — <strong>ไม่บังคับ</strong>,
                ไม่ต้องรู้หรือใส่ก็ได้
              </li>
            </ul>
            <p>
              <strong>ไม่ต้องใส่ Global Player ID ก็นำเข้าได้ปกติ</strong> — ใส่แค่ชื่อพอ ระบบจะค้นหาผู้เล่นที่ชื่อ
              ตรงกันทุกตัวอักษร (ไม่สนตัวพิมพ์เล็ก/ใหญ่) ในระบบก่อน ถ้าเจอจะใช้คนเดิม ไม่สร้างซ้ำ ถ้าไม่เจอ ระบบจะสร้าง
              ผู้เล่นใหม่และ<strong>สุ่ม Global Player ID ให้เองอัตโนมัติ</strong> ใส่คอลัมน์นี้เฉพาะกรณีต้องการยืนยันว่า
              เป็นผู้เล่นคนเดิมแน่ๆ ตาม ID ที่รู้อยู่แล้ว (เช่น ชื่อสะกดไม่ตรงกับที่เคยบันทึกไว้) — ถ้าใส่ ID ที่ไม่มีอยู่จริง
              แถวนั้นจะถูกข้ามพร้อมแจ้ง error เป็นรายแถว ไม่สร้างผู้เล่นใหม่ให้
            </p>
            <p>ผู้เล่นที่อยู่ในทัวร์นาเมนต์นี้อยู่แล้วจะถูกข้าม ไม่เพิ่มซ้ำ</p>
          </div>

          <form
            action={async (formData) => {
              await importPlayersToTournament(formData);
              setOpen(false);
            }}
            className="mt-4 space-y-4"
          >
            <input type="hidden" name="tournamentId" value={tournamentId} />
            <input type="file" name="file" accept=".csv,.xlsx,.xls,.json" required className={inputClass} />
            <div className="flex justify-end gap-2">
              <CancelButton onClick={() => setOpen(false)} />
              <Button type="submit" size="sm">
                นำเข้าผู้เล่น
              </Button>
            </div>
          </form>
        </ModalShell>
      )}
    </>
  );
}
