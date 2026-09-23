import { CurrentPairing } from "@/components/tournament-public/CurrentPairing";

export default async function PracticeCurrentPairingPage(props: PageProps<"/practice/[id]">) {
  const { id } = await props.params;
  return <CurrentPairing tournamentId={id} />;
}
