import { TournamentListPage } from "@/components/tournament-public/TournamentListPage";

export default async function PracticeListPage({ searchParams }: PageProps<"/practice">) {
  const { q } = await searchParams;
  const query = typeof q === "string" ? q.trim() : "";
  return <TournamentListPage mode="PRACTICE" query={query} />;
}
