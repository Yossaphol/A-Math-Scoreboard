import { ScoreboardTable } from "@/components/tournament-public/ScoreboardTable";

export default async function PracticeScoreboardPage(props: PageProps<"/practice/[id]/scoreboard">) {
  const { id } = await props.params;
  const { group } = await props.searchParams;
  return (
    <ScoreboardTable
      tournamentId={id}
      basePath={`/practice/${id}/scoreboard`}
      groupFilter={typeof group === "string" ? group : null}
    />
  );
}
