import { PublicTournamentShell } from "@/components/tournament-public/PublicTournamentShell";

export default async function PracticeTournamentLayout(props: LayoutProps<"/practice/[id]">) {
  const { id } = await props.params;
  return (
    <PublicTournamentShell id={id} expectedMode="PRACTICE">
      {props.children}
    </PublicTournamentShell>
  );
}
