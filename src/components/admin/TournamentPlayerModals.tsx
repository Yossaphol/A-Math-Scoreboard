"use client";

import { useEffect, useState, useTransition } from "react";
import {
  addPlayerToTournament,
  importPlayersToTournament,
  searchGlobalPlayersForTournament,
  type GlobalPlayerSearchResult,
} from "@/lib/actions/players";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { inputClass, labelClass } from "@/components/ui/styles";

/** Shared modal shell — same look as AddGlobalPlayerModal / NewRoundModal. Esc or a click on
 * the backdrop closes it. */
function ModalShell({
  title,
  maxWidth = "max-w-sm",
  onClose,
  children,
}: {
  title: string;
  maxWidth?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm px-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
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

/**
 * "Search first, create if missing" — the one entry point for adding a player. Typing searches
 * existing Global Players (so the same person keeps one Global Player ID across tournaments);
 * only when they aren't found does the admin switch to creating a new one, prefilled with what
 * they typed. The modal stays open after adding an existing player so several can be added.
 */
export function AddPlayerModal({ tournamentId }: { tournamentId: string }) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"search" | "create">("search");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GlobalPlayerSearchResult[] | null>(null);
  const [searching, startSearch] = useTransition();
  const [addingId, setAddingId] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (!q) return; // an empty box renders the hint, whatever `results` still holds
    const timer = setTimeout(() => {
      startSearch(async () => {
        setResults(await searchGlobalPlayersForTournament(tournamentId, q));
      });
    }, 250);
    return () => clearTimeout(timer);
  }, [open, query, tournamentId]);

  function close() {
    setOpen(false);
    setView("search");
    setQuery("");
    setResults(null);
  }

  async function addExisting(gp: GlobalPlayerSearchResult) {
    setAddingId(gp.id);
    try {
      const fd = new FormData();
      fd.set("tournamentId", tournamentId);
      fd.set("globalPlayerId", String(gp.id));
      await addPlayerToTournament(fd);
      setResults((rs) => rs?.map((r) => (r.id === gp.id ? { ...r, inTournament: true } : r)) ?? null);
    } finally {
      setAddingId(null);
    }
  }

  // A numeric query is almost certainly a Global Player ID, not a name worth prefilling.
  const prefillName = /^\d+$/.test(query.trim()) ? "" : query.trim();

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)} className="shrink-0">
        + เพิ่มผู้เล่น
      </Button>

      {open && (
        <ModalShell
          title={view === "search" ? "เพิ่มผู้เล่นเข้า Tournament" : "สร้างผู้เล่นใหม่"}
          maxWidth="max-w-md"
          onClose={close}
        >
          {view === "search" ? (
            <div className="mt-4">
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoFocus
                placeholder="ค้นหาผู้เล่นในระบบ — ชื่อ, Nickname หรือ Global Player ID"
                className={inputClass}
              />

              <div className="mt-3 min-h-[8rem]">
                {!query.trim() ? (
                  <p className="py-6 text-center text-xs text-neutral-500">
                    พิมพ์เพื่อค้นหาผู้เล่นที่เคยมีในระบบ — ใช้คนเดิมเพื่อเก็บประวัติข้าม Tournament
                  </p>
                ) : results === null || (searching && results.length === 0) ? (
                  <p className="py-6 text-center text-xs text-neutral-400">กำลังค้นหา...</p>
                ) : results.length === 0 ? (
                  <p className="py-6 text-center text-xs text-neutral-500">
                    ไม่พบผู้เล่นที่ตรงกับ &quot;{query.trim()}&quot;
                  </p>
                ) : (
                  <ul className={`divide-y divide-neutral-100 ${searching ? "opacity-60" : ""}`}>
                    {results.map((gp) => (
                      <li key={gp.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                        <div className="min-w-0 truncate">
                          <span className="font-medium">{gp.name}</span>
                          {gp.nickname && <span className="ml-2 text-xs text-neutral-500">{gp.nickname}</span>}
                          <span className="ml-2 text-xs text-neutral-400">#{gp.id}</span>
                        </div>
                        {gp.inTournament ? (
                          <Badge variant="neutral" className="shrink-0">
                            อยู่ใน Tournament แล้ว
                          </Badge>
                        ) : (
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            className="shrink-0"
                            disabled={addingId !== null}
                            onClick={() => addExisting(gp)}
                          >
                            {addingId === gp.id ? "กำลังเพิ่ม..." : "+ เพิ่ม"}
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="mt-3 flex items-center justify-between gap-2 border-t border-neutral-100 pt-4">
                <button
                  type="button"
                  onClick={() => setView("create")}
                  className="text-xs font-medium text-neutral-700 hover:underline"
                >
                  {prefillName ? `+ สร้างผู้เล่นใหม่ "${prefillName}"` : "+ สร้างผู้เล่นใหม่"}
                </button>
                <button
                  type="button"
                  onClick={close}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-black/5"
                >
                  เสร็จสิ้น
                </button>
              </div>
            </div>
          ) : (
            <form
              action={async (formData) => {
                await addPlayerToTournament(formData);
                close();
              }}
              className="mt-4 space-y-4"
            >
              <input type="hidden" name="tournamentId" value={tournamentId} />
              <div>
                <label className={labelClass}>ชื่อ</label>
                <input
                  name="name"
                  required
                  autoFocus
                  defaultValue={prefillName}
                  className={`${inputClass} mt-1`}
                />
              </div>
              <div>
                <label className={labelClass}>Nickname (ถ้ามี)</label>
                <input name="nickname" className={`${inputClass} mt-1`} />
              </div>
              <p className="text-xs text-neutral-500">ระบบจะสุ่ม Global Player ID ให้อัตโนมัติ</p>
              <div className="flex items-center justify-between gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setView("search")}
                  className="text-xs font-medium text-neutral-600 hover:underline"
                >
                  ← กลับไปค้นหา
                </button>
                <div className="flex gap-2">
                  <CancelButton onClick={close} />
                  <Button type="submit" size="sm">
                    สร้างและเพิ่มเข้า Tournament
                  </Button>
                </div>
              </div>
            </form>
          )}
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
        <ModalShell title="นำเข้าผู้เล่นจากไฟล์" maxWidth="max-w-lg" onClose={() => setOpen(false)}>
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
