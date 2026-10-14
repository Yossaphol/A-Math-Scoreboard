"use client";

import { useEffect, useState, useTransition } from "react";
import {
  addPlayerToTournament,
  importPlayersToTournament,
  searchGlobalPlayersForTournament,
  type GlobalPlayerSearchResult,
} from "@/lib/actions/players";
import { createGroup, renameGroup, deleteGroup, setPlayerGroup } from "@/lib/actions/groups";
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
export function AddPlayerModal({
  tournamentId,
  disabledReason,
}: {
  tournamentId: string;
  // Set when the Tournament's player limit is already reached — the button stays visible but
  // disabled, with the reason as its tooltip.
  disabledReason?: string;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
    setError(null);
  }

  async function addExisting(gp: GlobalPlayerSearchResult) {
    setAddingId(gp.id);
    try {
      const fd = new FormData();
      fd.set("tournamentId", tournamentId);
      fd.set("globalPlayerId", String(gp.id));
      const res = await addPlayerToTournament(fd);
      if (res?.error) {
        setError(res.error);
        return;
      }
      setResults((rs) => rs?.map((r) => (r.id === gp.id ? { ...r, inTournament: true } : r)) ?? null);
    } finally {
      setAddingId(null);
    }
  }

  // A numeric query is almost certainly a Global Player ID, not a name worth prefilling.
  const prefillName = /^\d+$/.test(query.trim()) ? "" : query.trim();

  return (
    <>
      <Button
        type="button"
        onClick={() => setOpen(true)}
        className="shrink-0"
        disabled={!!disabledReason}
        title={disabledReason}
      >
        + เพิ่มผู้เล่น
      </Button>

      {open && (
        <ModalShell
          title={view === "search" ? "เพิ่มผู้เล่นเข้า Tournament" : "สร้างผู้เล่นใหม่"}
          maxWidth="max-w-md"
          onClose={close}
        >
          {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-danger">{error}</p>}
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
                const res = await addPlayerToTournament(formData);
                if (res?.error) {
                  setError(res.error);
                  return;
                }
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
export function ImportPlayersModal({
  tournamentId,
  disabledReason,
}: {
  tournamentId: string;
  disabledReason?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        onClick={() => setOpen(true)}
        className="shrink-0"
        disabled={!!disabledReason}
        title={disabledReason}
      >
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
              <li>
                <code>group</code> / <code>กลุ่ม</code> / <code>เพศ</code> — ไม่บังคับ เช่น ชาย / หญิง ใช้แยกจับคู่
                (ถ้ายังไม่มีกลุ่มชื่อนั้น ระบบจะสร้างให้) ผู้เล่นที่อยู่ใน Tournament แล้วจะถูกอัปเดตกลุ่มตามไฟล์
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
            <p>ถ้ากำหนดจำนวนผู้เล่นไว้ จะนำเข้าตามลำดับแถวจนครบจำนวน แถวที่เกินจะไม่ถูกนำเข้า</p>
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

/** The player's pairing group, saved as soon as it's picked. */
export function PlayerGroupSelect({
  tournamentPlayerId,
  groupId,
  groups,
}: {
  tournamentPlayerId: string;
  groupId: string | null;
  groups: { id: string; name: string }[];
}) {
  const [pending, startTransition] = useTransition();
  return (
    <select
      aria-label="กลุ่ม"
      defaultValue={groupId ?? ""}
      disabled={pending}
      onChange={(e) => {
        const fd = new FormData();
        fd.set("tournamentPlayerId", tournamentPlayerId);
        fd.set("groupId", e.target.value);
        startTransition(() => setPlayerGroup(fd));
      }}
      className={`rounded-lg border border-neutral-200 bg-white px-2 py-1 text-xs ${
        groupId ? "text-neutral-900" : "text-neutral-400"
      } ${pending ? "opacity-60" : ""}`}
    >
      <option value="">— ไม่มีกลุ่ม —</option>
      {groups.map((g) => (
        <option key={g.id} value={g.id}>
          {g.name}
        </option>
      ))}
    </select>
  );
}

/** Create / rename / delete the Tournament's pairing groups (ชาย / หญิง, ...). */
export function ManageGroupsModal({
  tournamentId,
  groups,
}: {
  tournamentId: string;
  groups: { id: string; name: string; playerCount: number; usedInRounds: number }[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" variant="secondary" onClick={() => setOpen(true)} className="shrink-0">
        กลุ่ม{groups.length > 0 ? ` (${groups.length})` : ""}
      </Button>

      {open && (
        <ModalShell title="กลุ่มผู้เล่น" maxWidth="max-w-md" onClose={() => setOpen(false)}>
          <p className="mt-2 text-xs text-neutral-500">
            ใช้แยกจับคู่ เช่น ชาย / หญิง — ตอนสร้าง Round ติ๊ก &quot;แยกจับคู่ตามกลุ่ม&quot; แล้วแต่ละกลุ่มจะแข่งกันเอง
            คะแนนสะสมยังนับรวมเหมือนเดิม เลือกกลุ่มของผู้เล่นแต่ละคนได้ในคอลัมน์ &quot;กลุ่ม&quot;
          </p>

          <ul className="mt-4 space-y-2">
            {groups.map((g) => (
              <li key={g.id} className="flex items-center gap-2">
                <form action={renameGroup} className="flex flex-1 items-center gap-2">
                  <input type="hidden" name="groupId" value={g.id} />
                  <input name="name" defaultValue={g.name} required className={`${inputClass} flex-1`} />
                  <span className="shrink-0 text-xs text-neutral-400">{g.playerCount} คน</span>
                  <Button type="submit" variant="secondary" size="sm" className="shrink-0">
                    บันทึก
                  </Button>
                </form>
                <form action={deleteGroup}>
                  <input type="hidden" name="groupId" value={g.id} />
                  <Button
                    type="submit"
                    variant="danger"
                    size="sm"
                    disabled={g.usedInRounds > 0}
                    title={g.usedInRounds > 0 ? "ถูกใช้แยกจับคู่ไปแล้ว ลบไม่ได้" : undefined}
                  >
                    ลบ
                  </Button>
                </form>
              </li>
            ))}
          </ul>

          <form action={createGroup} className="mt-4 flex items-center gap-2 border-t border-neutral-100 pt-4">
            <input type="hidden" name="tournamentId" value={tournamentId} />
            <input name="name" required placeholder="ชื่อกลุ่มใหม่ เช่น ชาย" className={`${inputClass} flex-1`} />
            <Button type="submit" size="sm" className="shrink-0">
              + เพิ่มกลุ่ม
            </Button>
          </form>

          <div className="mt-4 flex justify-end">
            <CancelButton onClick={() => setOpen(false)} />
          </div>
        </ModalShell>
      )}
    </>
  );
}
