"use client";

import { Fragment, useState } from "react";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { inputClass } from "@/components/ui/styles";

export type PlayersTableRow = {
  id: string;
  /** Lower-cased text the filter matches against (name, nickname, player numbers). */
  searchText: string;
  node: React.ReactNode;
};

/**
 * The tournament Players tab: a toolbar (instant filter over this tournament's roster + the
 * add/import buttons passed in as `actions`) above the roster table. Rows are rendered on the
 * server; filtering only hides them client-side, so typing never waits on a round trip.
 */
export function PlayersTable({
  actions,
  header,
  rows,
}: {
  actions: React.ReactNode;
  header: React.ReactNode;
  rows: PlayersTableRow[];
}) {
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const visible = needle ? rows.filter((r) => r.searchText.includes(needle)) : rows;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-[14rem] flex-1">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ค้นหาผู้เล่นใน Tournament นี้ — ชื่อ, Nickname หรือหมายเลข"
            aria-label="ค้นหาผู้เล่นใน Tournament นี้"
            className={inputClass}
          />
        </div>
        {actions}
      </div>

      {rows.length > 0 && (
        <p className="mt-3 text-xs text-neutral-500">
          {needle ? `พบ ${visible.length} จาก ${rows.length} คน` : `ผู้เล่นทั้งหมด ${rows.length} คน`}
          {" · "}กดที่แถวเพื่อดูประวัติแต่ละ Round
        </p>
      )}

      <Card padding="p-0" className="mt-2 overflow-x-auto">
        {rows.length === 0 ? (
          <div className="p-6">
            <EmptyState title="ยังไม่มีผู้เล่น" description='กด "+ เพิ่มผู้เล่น" หรือ "นำเข้าจากไฟล์" เพื่อเริ่มต้น' />
          </div>
        ) : visible.length === 0 ? (
          <p className="py-10 text-center text-sm text-neutral-500">
            ไม่พบผู้เล่นที่ตรงกับ &quot;{query.trim()}&quot; ใน Tournament นี้
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>{header}</thead>
            <tbody>
              {visible.map((r) => (
                <Fragment key={r.id}>{r.node}</Fragment>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
