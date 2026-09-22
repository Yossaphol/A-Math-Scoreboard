import "server-only";
import Papa from "papaparse";
import * as XLSX from "xlsx";

export type RawPlayerRow = {
  name?: string;
  nickname?: string;
  globalPlayerId?: number;
};

const NAME_KEYS = ["name", "ชื่อ"];
const NICKNAME_KEYS = ["nickname", "ชื่อเล่น"];
const ID_KEYS = ["globalplayerid", "global player id", "playerid", "player id", "id", "รหัส"];

// Column headers are matched case-insensitively (and a couple of Thai aliases), since a
// spreadsheet someone hands-typed is never going to match a fixed casing exactly.
function normalizeRow(raw: Record<string, unknown>): RawPlayerRow {
  const byLowerKey = new Map<string, unknown>();
  for (const [key, value] of Object.entries(raw)) {
    byLowerKey.set(key.trim().toLowerCase(), value);
  }

  const pick = (keys: string[]) => {
    for (const k of keys) {
      const v = byLowerKey.get(k);
      if (v != null && String(v).trim() !== "") return String(v).trim();
    }
    return undefined;
  };

  const idStr = pick(ID_KEYS);
  const id = idStr && /^\d+$/.test(idStr) ? Number(idStr) : undefined;

  return { name: pick(NAME_KEYS), nickname: pick(NICKNAME_KEYS), globalPlayerId: id };
}

const MAX_ROWS = 1000;

export class PlayerImportError extends Error {}

/** Accepts .csv, .xlsx/.xls, or .json and returns a normalized row list. Each row is either
 * an existing Player's ID (to add as-is) or a name (+ optional nickname) to match/create. */
export async function parsePlayerImportFile(file: File): Promise<RawPlayerRow[]> {
  const filename = file.name.toLowerCase();
  let rows: RawPlayerRow[];

  if (filename.endsWith(".csv")) {
    const text = await file.text();
    const parsed = Papa.parse<Record<string, unknown>>(text, { header: true, skipEmptyLines: true });
    if (parsed.errors.length > 0) {
      throw new PlayerImportError(`อ่านไฟล์ CSV ไม่สำเร็จ: ${parsed.errors[0].message}`);
    }
    rows = parsed.data.map(normalizeRow);
  } else if (filename.endsWith(".xlsx") || filename.endsWith(".xls")) {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!firstSheet) throw new PlayerImportError("ไม่พบข้อมูลใน Sheet แรกของไฟล์");
    const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, { defval: "" });
    rows = raw.map(normalizeRow);
  } else if (filename.endsWith(".json")) {
    const text = await file.text();
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new PlayerImportError("ไฟล์ JSON ไม่ถูกต้อง (parse ไม่สำเร็จ)");
    }
    if (!Array.isArray(parsed)) {
      throw new PlayerImportError("ไฟล์ JSON ต้องเป็น array (เช่น [{\"name\":\"...\"}] หรือ [\"ชื่อ1\", \"ชื่อ2\"])");
    }
    rows = parsed.map((item) =>
      typeof item === "string" ? { name: item.trim() } : normalizeRow(item as Record<string, unknown>)
    );
  } else {
    throw new PlayerImportError("รองรับเฉพาะไฟล์ .csv, .xlsx หรือ .json เท่านั้น");
  }

  const withData = rows.filter((r) => r.name || r.globalPlayerId != null);
  if (withData.length === 0) {
    throw new PlayerImportError("ไม่พบข้อมูลผู้เล่นในไฟล์ (ต้องมีคอลัมน์ name หรือ globalPlayerId อย่างน้อยหนึ่งอย่าง)");
  }
  if (withData.length > MAX_ROWS) {
    throw new PlayerImportError(`ไฟล์มีผู้เล่นมากเกินไป (${withData.length} แถว) นำเข้าได้ครั้งละไม่เกิน ${MAX_ROWS} คน`);
  }
  return withData;
}
