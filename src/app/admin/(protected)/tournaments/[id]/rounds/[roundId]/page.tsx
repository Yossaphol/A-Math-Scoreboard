import { notFound } from "next/navigation";
import { requireTournamentAccess } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { adminSetMatchResult } from "@/lib/actions/match";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { MATCH_STATUS_BADGE, ROUND_STATUS_BADGE } from "@/lib/status-labels";

export default async function AdminRoundDetailPage(
  props: PageProps<"/admin/tournaments/[id]/rounds/[roundId]">
) {
  const { id, roundId } = await props.params;
  await requireTournamentAccess(id);

  const round = await prisma.round.findUnique({
    where: { id: roundId },
    include: {
      matches: {
        include: {
          table: true,
          player1: { include: { globalPlayer: true } },
          player2: { include: { globalPlayer: true } },
          submissions: true,
        },
      },
    },
  });
  if (!round || round.tournamentId !== id) notFound();

  const roundStatus = ROUND_STATUS_BADGE[round.status];

  return (
    <div>
      <PageHeader
        title={`Round ${round.roundNumber}`}
        actions={<Badge variant={roundStatus.variant}>{roundStatus.label}</Badge>}
      />

      <ul className="space-y-3">
        {round.matches.map((m) => {
          const p1Sub = m.submissions.find((s) => s.side === "PLAYER1");
          const p2Sub = m.submissions.find((s) => s.side === "PLAYER2");
          const status = MATCH_STATUS_BADGE[m.status];

          return (
            <li key={m.id}>
              <Card padding="p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="min-w-0 break-words font-medium">
                    {m.player1.globalPlayer.name}
                    {m.player2 ? ` vs ${m.player2.globalPlayer.name}` : " (Bye)"}
                  </span>
                  <div className="flex shrink-0 items-center gap-2">
                    {m.table && (
                      <span className="text-xs text-neutral-500">Table {m.table.tableNumber}</span>
                    )}
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </div>
                </div>

                {m.status === "CONFIRMED" && !m.isBye && (
                  <p className="mt-1.5 text-xs text-neutral-500">
                    ผล: {m.finalPlayer1Score} - {m.finalPlayer2Score}
                    {m.editedByAdminId && " (แก้ไขโดย Admin/Staff)"}
                  </p>
                )}

                {m.status === "CONFLICT" && (p1Sub || p2Sub) && (
                  <div className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-danger">
                    <p>
                      {m.player1.globalPlayer.name} ส่ง: {p1Sub?.player1Score ?? "—"} -{" "}
                      {p1Sub?.player2Score ?? "—"}
                    </p>
                    <p>
                      {m.player2?.globalPlayer.name} ส่ง: {p2Sub?.player1Score ?? "—"} -{" "}
                      {p2Sub?.player2Score ?? "—"}
                    </p>
                  </div>
                )}

                {!m.isBye && m.status !== "CONFIRMED" && (
                  <form action={adminSetMatchResult} className="mt-3 flex flex-wrap items-end gap-2">
                    <input type="hidden" name="matchId" value={m.id} />
                    <ScoreField
                      label={m.player1.globalPlayer.name}
                      name="player1Score"
                      defaultValue={p1Sub?.player1Score ?? p2Sub?.player1Score}
                    />
                    <ScoreField
                      label={m.player2?.globalPlayer.name ?? ""}
                      name="player2Score"
                      defaultValue={p1Sub?.player2Score ?? p2Sub?.player2Score}
                    />
                    <button
                      type="submit"
                      className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-700"
                    >
                      บันทึกผล (Admin)
                    </button>
                  </form>
                )}

                {!m.isBye && m.status === "CONFIRMED" && (
                  <details className="mt-2 group">
                    <summary className="cursor-pointer text-xs text-neutral-500 group-open:mb-2">
                      แก้ไขผล
                    </summary>
                    <form action={adminSetMatchResult} className="flex flex-wrap items-end gap-2">
                      <input type="hidden" name="matchId" value={m.id} />
                      <ScoreField
                        label={m.player1.globalPlayer.name}
                        name="player1Score"
                        defaultValue={m.finalPlayer1Score ?? undefined}
                      />
                      <ScoreField
                        label={m.player2?.globalPlayer.name ?? ""}
                        name="player2Score"
                        defaultValue={m.finalPlayer2Score ?? undefined}
                      />
                      <button
                        type="submit"
                        className="rounded-lg border border-neutral-200 bg-white/70 px-3 py-1.5 text-xs hover:bg-white"
                      >
                        บันทึก
                      </button>
                    </form>
                  </details>
                )}
              </Card>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ScoreField({
  label,
  name,
  defaultValue,
}: {
  label: string;
  name: string;
  defaultValue?: number;
}) {
  return (
    <div>
      <label className="text-[11px] text-neutral-500">{label}</label>
      <input
        type="number"
        min={0}
        name={name}
        defaultValue={defaultValue}
        required
        className="mt-1 block w-24 rounded-lg border border-neutral-200 bg-white/70 px-2 py-1.5 text-sm outline-none focus:border-accent"
      />
    </div>
  );
}
