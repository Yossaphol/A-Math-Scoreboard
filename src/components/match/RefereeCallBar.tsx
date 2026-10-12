import { prisma } from "@/lib/prisma";
import { OPEN_REFEREE_CALL_STATUSES } from "@/lib/referee-calls";
import { callReferee, cancelRefereeCall } from "@/lib/actions/referee-calls";
import { AutoRefresh } from "@/components/ui/AutoRefresh";
import { SubmitButton } from "@/components/ui/SubmitButton";

export async function getOpenRefereeCall(qrToken: string) {
  return prisma.refereeCall.findFirst({
    where: { table: { qrToken }, status: { in: OPEN_REFEREE_CALL_STATUSES } },
    select: { id: true, status: true },
  });
}

/**
 * Bottom bar on the table QR page: one tap pages every Admin/Staff screen for this
 * tournament (see RefereeCallAlerts). Once called it shows whether a referee has picked it
 * up, refreshing quickly so "on the way" appears soon after they tap it.
 */
export function RefereeCallBar({
  qrToken,
  call,
}: {
  qrToken: string;
  call: { id: string; status: string } | null;
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-neutral-200/70 bg-white/85 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-md">
      <div className="mx-auto max-w-md">
        {call ? (
          <>
            <AutoRefresh intervalMs={2000} />
            <div className="flex items-center gap-3">
              <span className="relative flex size-3 shrink-0">
                {call.status === "OPEN" && (
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-amber-400 opacity-75" />
                )}
                <span
                  className={`relative inline-flex size-3 rounded-full ${call.status === "OPEN" ? "bg-amber-500" : "bg-emerald-500"}`}
                />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-neutral-900">
                  {call.status === "OPEN" ? "กำลังเรียกกรรมการ…" : "กรรมการรับเรื่องแล้ว กำลังมา"}
                </p>
                <p className="text-xs text-neutral-500">รอที่โต๊ะได้เลย</p>
              </div>
              <form action={cancelRefereeCall}>
                <input type="hidden" name="qrToken" value={qrToken} />
                <input type="hidden" name="callId" value={call.id} />
                <SubmitButton variant="ghost" size="sm" pendingLabel="กำลังยกเลิก...">
                  ยกเลิก
                </SubmitButton>
              </form>
            </div>
          </>
        ) : (
          <form action={callReferee}>
            <input type="hidden" name="qrToken" value={qrToken} />
            <SubmitButton
              pendingLabel="กำลังเรียก..."
              className="btn-sunlight h-12 w-full !rounded-xl text-[15px] transition-[filter]"
            >
              <svg viewBox="0 0 24 24" fill="none" className="size-5" aria-hidden="true">
                <path
                  d="M6 8a6 6 0 1112 0c0 7 3 9 3 9H3s3-2 3-9zM10.3 21a1.94 1.94 0 003.4 0"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              เรียกกรรมการ
            </SubmitButton>
          </form>
        )}
      </div>
    </div>
  );
}
