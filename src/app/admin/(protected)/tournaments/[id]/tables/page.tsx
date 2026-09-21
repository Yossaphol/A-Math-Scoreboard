import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { QrCode } from "@/components/ui/QrCode";

export default async function AdminTablesPage(props: PageProps<"/admin/tournaments/[id]/tables">) {
  const { id } = await props.params;
  const [tables, tournament] = await Promise.all([
    prisma.tournamentTable.findMany({ where: { tournamentId: id }, orderBy: { tableNumber: "asc" } }),
    prisma.tournament.findUniqueOrThrow({ where: { id }, select: { name: true } }),
  ]);

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const slug = tournament.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");

  return (
    <div>
      <p className="mb-4 text-xs text-neutral-500">
        QR Code ผูกกับ Table และใช้ได้ตลอด Tournament (spec §12) — สแกนแล้วเจอ Match ปัจจุบันของโต๊ะนั้นทันที
        จำนวนโต๊ะปรับตามจำนวนผู้เล่นอัตโนมัติ (ปัดขึ้นจาก player ÷ 2) ดาวน์โหลดรูปไปพิมพ์แปะโต๊ะจริงได้เลย
        หรือถ้าไม่สะดวกสแกน กดลิงก์ด้านล่างเพื่อกรอกผลได้โดยตรง
      </p>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {tables.map((t) => {
          const url = `${baseUrl}/table/${t.qrToken}`;
          return (
            <Card key={t.id} padding="p-4" className="flex flex-col items-center text-center">
              <p className="mb-2 text-lg font-semibold text-neutral-900">โต๊ะ {t.tableNumber}</p>
              <QrCode value={url} size={160} downloadName={`${slug || "table"}-table-${t.tableNumber}-qr.png`} />
              <Link
                href={`/table/${t.qrToken}`}
                target="_blank"
                className="mt-2 break-all text-[11px] text-accent hover:underline"
              >
                {url}
              </Link>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
