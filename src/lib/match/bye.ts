// Spec §19: a Bye is a W worth a 100-0 game (Diff +100), never capped by Maximum Score.
// The same 100 is the forfeit for a no-show (RoundAbsence): L 0-100 (Diff -100). A player whose
// opponent didn't show is re-paired with another such player first, and only gets a Bye when
// the count left over is odd — see repairRoundForAbsences.
export const BYE_SCORE = 100;
