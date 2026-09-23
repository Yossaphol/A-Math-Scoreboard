import { ScoreboardTable } from "@/components/tournament-public/ScoreboardTable";

export default async function PracticeScoreboardPage(props: PageProps<"/practice/[id]/scoreboard">) {
  const { id } = await props.params;
  return <ScoreboardTable tournamentId={id} />;
}
