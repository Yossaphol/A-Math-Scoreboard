export type Standing = {
  id: string; // TournamentPlayer id
  tournamentPlayerNo: number;
  points: number; // W*2 + T*1 (spec §19)
  diff: number; // cumulative Diff (Maximum Score already applied per game, see standings.ts)
  opponents: Set<string>; // TournamentPlayer ids already faced in a CONFIRMED match
  hadBye: boolean;
};

export type PairResult = {
  player1Id: string;
  player2Id: string | null; // null = Bye
};
