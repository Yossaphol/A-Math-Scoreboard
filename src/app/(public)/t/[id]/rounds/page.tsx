import { RoundsList } from "@/components/tournament-public/RoundsList";

export default async function RoundsPage(props: PageProps<"/t/[id]/rounds">) {
  const { id } = await props.params;
  return <RoundsList tournamentId={id} basePath={`/t/${id}`} />;
}
