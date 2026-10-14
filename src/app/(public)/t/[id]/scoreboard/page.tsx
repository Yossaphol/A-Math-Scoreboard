import { ScoreboardTable } from "@/components/tournament-public/ScoreboardTable";

export default async function ScoreboardPage(props: PageProps<"/t/[id]/scoreboard">) {
  const { id } = await props.params;
  const { group } = await props.searchParams;
  return (
    <ScoreboardTable
      tournamentId={id}
      basePath={`/t/${id}/scoreboard`}
      groupFilter={typeof group === "string" ? group : null}
    />
  );
}
