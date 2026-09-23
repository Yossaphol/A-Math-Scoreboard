import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ensureSelfServiceToken } from "@/lib/actions/tournaments";
import { Card } from "@/components/ui/Card";
import { QrCode } from "@/components/ui/QrCode";

export default async function PracticeLinkPage(props: PageProps<"/admin/tournaments/[id]/practice">) {
  const { id } = await props.params;
  const tournament = await prisma.tournament.findUniqueOrThrow({ where: { id } });
  if (tournament.mode !== "PRACTICE") notFound();

  const token = await ensureSelfServiceToken(id);
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const url = `${baseUrl}/practice/play/${token}`;

  return (
    <div>
      <p className="mb-4 text-xs text-neutral-500">
        ลิงก์นี้ใช้ได้ตลอดทั้งทัวร์นาเมนต์ ผู้เล่นเปิดเข้ามากรอกผลได้เองทุกเมื่อโดยไม่ต้องรอ Staff จับคู่ก่อน —
        เลือกชื่อตัวเอง เลือกคู่แข่ง แล้วกรอกผลได้เลย ต้องยืนยันตรงกันทั้งสองฝ่ายเหมือนกับที่โต๊ะ
      </p>
      <Card padding="p-4" className="flex max-w-xs flex-col items-center text-center">
        <QrCode value={url} size={200} downloadName="practice-self-service-qr.png" />
        <a
          href={url}
          target="_blank"
          className="mt-2 break-all text-[11px] text-accent hover:underline"
        >
          {url}
        </a>
      </Card>
    </div>
  );
}
