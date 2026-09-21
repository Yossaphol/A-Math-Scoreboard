import QRCode from "qrcode";

export async function QrCode({
  value,
  size = 160,
  downloadName,
}: {
  value: string;
  size?: number;
  /** File name offered when the viewer downloads the PNG (e.g. to print and tape to a table). */
  downloadName?: string;
}) {
  const dataUrl = await QRCode.toDataURL(value, { width: size, margin: 1 });

  return (
    <div className="flex flex-col items-center gap-2">
      {/* eslint-disable-next-line @next/next/no-img-element -- data: URI, next/image can't optimize it anyway */}
      <img src={dataUrl} width={size} height={size} alt={`QR code for ${value}`} className="rounded-lg" />
      {downloadName && (
        <a
          href={dataUrl}
          download={downloadName}
          className="text-[11px] font-medium text-accent hover:underline"
        >
          ดาวน์โหลด PNG
        </a>
      )}
    </div>
  );
}
