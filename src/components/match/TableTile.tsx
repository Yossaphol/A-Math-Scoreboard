// The table number as the first thing on a match card — staff walk the hall by table number,
// so it has to be readable at a glance, not a small label tucked in a corner.
export function TableTile({ tableNumber }: { tableNumber: number | null }) {
  return (
    <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl border border-neutral-200/80 bg-white">
      {tableNumber == null ? (
        <span className="text-xs font-medium text-neutral-400">Bye</span>
      ) : (
        <>
          <span className="text-[10px] leading-none tracking-wide text-neutral-500">โต๊ะ</span>
          <span className="mt-0.5 text-2xl font-semibold leading-none tabular-nums text-neutral-900">
            {tableNumber}
          </span>
        </>
      )}
    </div>
  );
}
