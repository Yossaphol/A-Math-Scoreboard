// One search box for finding a match during a round, shared by the Round page and the
// "กรอกผล" page. What people actually know at the hall differs, so the box accepts all of it:
//   "5"        → table 5 (exact)
//   "#5"       → tournament player number 5
//   anything else → part of a player's name or nickname (case-insensitive)

export type MatchSearchKey = {
  table: number | null;
  players: { no: number; name: string; nickname: string | null }[];
};

export function matchSearch(query: string): ((key: MatchSearchKey) => boolean) | null {
  const q = query.trim().toLowerCase();
  if (!q) return null;

  if (/^#\d+$/.test(q)) {
    const no = Number(q.slice(1));
    return (k) => k.players.some((p) => p.no === no);
  }
  if (/^\d+$/.test(q)) {
    const table = Number(q);
    return (k) => k.table === table;
  }
  return (k) =>
    k.players.some((p) => p.name.toLowerCase().includes(q) || (p.nickname ?? "").toLowerCase().includes(q));
}
