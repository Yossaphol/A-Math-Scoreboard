import { PlayerList } from "@/components/tournament-public/PlayerList";

export default async function PracticePlayersPage(props: PageProps<"/practice/[id]/players">) {
  const { id } = await props.params;
  const { q } = await props.searchParams;
  const query = typeof q === "string" ? q.trim() : "";
  return <PlayerList tournamentId={id} query={query} />;
}
