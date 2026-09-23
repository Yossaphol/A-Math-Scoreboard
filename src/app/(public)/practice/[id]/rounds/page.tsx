import { RoundsList } from "@/components/tournament-public/RoundsList";

export default async function PracticeRoundsPage(props: PageProps<"/practice/[id]/rounds">) {
  const { id } = await props.params;
  return <RoundsList tournamentId={id} basePath={`/practice/${id}`} />;
}
