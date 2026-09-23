import { RoundDetail } from "@/components/tournament-public/RoundDetail";

export default async function PracticeRoundDetailPage(props: PageProps<"/practice/[id]/rounds/[roundId]">) {
  const { id, roundId } = await props.params;
  return <RoundDetail tournamentId={id} roundId={roundId} />;
}
