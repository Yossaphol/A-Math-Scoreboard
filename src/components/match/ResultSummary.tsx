import { Badge } from "@/components/ui/Badge";

const OUTCOME = {
  WIN: { label: "ชนะ", variant: "success" },
  TIE: { label: "เสมอ", variant: "warning" },
  LOSS: { label: "แพ้", variant: "neutral" },
} as const;

type Side = { name: string; score: number };

function outcome(me: number, them: number): keyof typeof OUTCOME {
  return me === them ? "TIE" : me > them ? "WIN" : "LOSS";
}

// Both players' names, scores and W/T/L as one small scoreboard — used for the confirmation
// popup before a result is sent and for the "sent, waiting for the other side" state, so a
// player always sees exactly the result that is (or is about to be) on record.
export function ResultSummary({ player1, player2 }: { player1: Side; player2: Side }) {
  const rows = [
    { ...player1, outcome: outcome(player1.score, player2.score) },
    { ...player2, outcome: outcome(player2.score, player1.score) },
  ];
  return (
    <dl className="divide-y divide-neutral-200/70 rounded-xl border border-neutral-200/70 bg-white/60 text-left">
      {rows.map((r, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-2.5">
          <dt
            className={`min-w-0 flex-1 truncate text-sm ${
              r.outcome === "WIN" ? "font-semibold text-neutral-900" : "text-neutral-700"
            }`}
          >
            {r.name}
          </dt>
          <dd className="text-lg font-semibold tabular-nums text-neutral-900">{r.score}</dd>
          <dd className="w-12 text-right">
            <Badge variant={OUTCOME[r.outcome].variant}>{OUTCOME[r.outcome].label}</Badge>
          </dd>
        </div>
      ))}
    </dl>
  );
}
