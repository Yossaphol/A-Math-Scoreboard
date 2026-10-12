import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { QrCode } from "@/components/ui/QrCode";
import { CopyLinkField } from "@/components/ui/CopyLinkField";
import { buttonBase, SIZES, VARIANTS } from "@/components/ui/Button";
import { tableQrUrl } from "@/lib/tables";

export default async function AdminTablesPage(props: PageProps<"/admin/tournaments/[id]/tables">) {
  const { id } = await props.params;
  const tables = await prisma.tournamentTable.findMany({
    where: { tournamentId: id },
    orderBy: { tableNumber: "asc" },
  });

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <p className="min-w-0 flex-1 text-xs text-neutral-500">
          QR Code ผูกกับ Table และใช้ได้ตลอด Tournament (spec §12) — สแกนแล้วเจอ Match ปัจจุบันของโต๊ะนั้นทันที
          จำนวนโต๊ะปรับตามจำนวนผู้เล่นอัตโนมัติ (ปัดขึ้นจาก player ÷ 2) ดาวน์โหลดรูปไปพิมพ์แปะโต๊ะจริงได้เลย
          หรือถ้าไม่สะดวกสแกน ใช้ลิงก์ใต้ QR เพื่อกรอกผลได้โดยตรง
        </p>
        {tables.length > 0 && (
          // Plain <a>, not next/link: this is a file download from a route handler, not a page.
          <a
            href={`/admin/tournaments/${id}/tables/download`}
            download
            className={`${buttonBase} ${VARIANTS.primary} ${SIZES.md} shrink-0`}
          >
            ดาวน์โหลด QR ทั้งหมด (.zip)
          </a>
        )}
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {tables.map((t) => {
          const url = tableQrUrl(t.qrToken);
          return (
            <Card key={t.id} padding="p-4" className="flex min-w-0 flex-col items-center text-center">
              <p className="mb-2 text-lg font-semibold text-neutral-900">โต๊ะ {t.tableNumber}</p>
              <QrCode value={url} size={160} downloadName={`table_${t.tableNumber}.png`} />
              <div className="mt-3 w-full min-w-0">
                <CopyLinkField url={url} />
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
