import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { PairList, StandingsTable } from "@/components/dev/SwissBoard";
import { SwissSimulator } from "@/components/dev/SwissSimulator";
import { rankOrder, swissPairing } from "@/lib/pairing/algorithms";
import { SWISS_CASES, pairLabel } from "@/lib/pairing/swiss-cases";

export const metadata: Metadata = { title: "Swiss Test Cases" };

// Dev-only visual check of swissPairing: the exact cases algorithms.smoketest.ts asserts, run
// through the live function, plus a seeded multi-round simulator. No DB, no auth — and 404 in
// production builds so it never ships to real users.
export default function SwissTestPage() {
  if (process.env.NODE_ENV === "production") notFound();

  const results = SWISS_CASES.map((c) => {
    const pairs = swissPairing(c.standings);
    const passed = pairs.map(pairLabel).join(" ") === c.expected.join(" ");
    return { ...c, ranked: rankOrder(c.standings), pairs, passed };
  });
  const passedCount = results.filter((r) => r.passed).length;

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8">
      <PageHeader
        title="Swiss Pairing · Test Cases"
        subtitle="รัน swissPairing ตัวจริงจาก src/lib/pairing/algorithms.ts · หน้านี้เปิดได้เฉพาะ next dev"
        actions={
          <Badge variant={passedCount === results.length ? "success" : "danger"}>
            ตรงตามที่คาด {passedCount}/{results.length} เคส
          </Badge>
        }
      />

      <Card padding="p-4" className="mb-6 text-sm text-neutral-700">
        <p className="mb-2 font-semibold text-neutral-900">กติกาที่ระบบใช้</p>
        <ol className="list-decimal space-y-1 pl-5">
          <li>เรียงอันดับ: แต้ม (W=2 T=1 L=0) → Diff สะสม (cap แล้ว) → เลขผู้เล่น</li>
          <li>ผู้เล่นคี่: อันดับสุดท้ายได้ Bye เสมอ (ตัดออกก่อนแบ่งกลุ่ม)</li>
          <li>แบ่งกลุ่มตามแต้ม แต่ละกลุ่มแบ่งครึ่ง แล้วจับครึ่งบนกับครึ่งล่างตามลำดับ เช่น {"{1,2}{3,4}"} → 1-3, 2-4</li>
          <li>กลุ่มไหนจำนวนคี่ ดึงอันดับสูงสุดของกลุ่มถัดไป (Diff มากสุด) ขึ้นมาเติม</li>
          <li>ไม่หลบคู่ที่เคยเจอกันแล้ว (สลับเองได้ในหน้า Preview)</li>
        </ol>
        <p className="mt-3 text-xs text-neutral-500">
          สีพื้นสลับกันตามกลุ่มแต้ม · ตัวเลขในกล่องดำ = อันดับ · #N = เลขผู้เล่น (ในเคสส่วนใหญ่ตั้งให้เลขผู้เล่น = อันดับ
          จะได้อ่านแบบเดียวกับที่เขียน &quot;1-3, 2-4&quot;)
        </p>
      </Card>

      <div className="space-y-4">
        {results.map((r, i) => (
          <Card key={r.title} padding="p-4">
            <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-neutral-900">
                  เคส {i + 1}: {r.title}
                </h2>
                <p className="mt-0.5 text-xs text-neutral-500">{r.note}</p>
              </div>
              <Badge variant={r.passed ? "success" : "danger"}>{r.passed ? "ตรงตามที่คาด" : "ไม่ตรง"}</Badge>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <p className="mb-1.5 text-xs text-neutral-500">อันดับก่อนจับคู่ (input)</p>
                <StandingsTable ranked={r.ranked} />
              </div>
              <div>
                <p className="mb-1.5 text-xs text-neutral-500">คู่ที่ swissPairing จับได้ (เทียบกับที่ควรได้)</p>
                <PairList ranked={r.ranked} pairs={r.pairs} expected={r.expected} />
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div id="simulator" className="mt-10 scroll-mt-4">
        <PageHeader
          title="ตัวจำลองหลายเกม"
          subtitle="สุ่มผลทีละเกม แล้วส่งอันดับเข้า swissPairing ตัวจริง — ลองเปลี่ยนจำนวนผู้เล่น/Seed เพื่อดูเคสอื่น"
        />
        <SwissSimulator />
      </div>
    </main>
  );
}
