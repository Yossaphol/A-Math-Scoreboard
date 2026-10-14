type BadgeVariant = "neutral" | "accent" | "success" | "warning" | "danger" | "info";

export const PAIRING_METHOD_LABEL: Record<string, string> = {
  RANDOM: "Random",
  SWISS: "Swiss",
  KING_OF_THE_HILL: "King of the Hill",
  ROUND_ROBIN: "Round Robin",
};

/** How a Round was paired — a split Round names each group's own method. */
export function roundMethodLabel(round: {
  pairingMethod: string | null;
  splitByGroup: boolean;
  groupMethods?: { pairingMethod: string; group: { name: string } }[];
}): string {
  if (round.splitByGroup) {
    const parts = (round.groupMethods ?? []).map(
      (g) => `${g.group.name}: ${PAIRING_METHOD_LABEL[g.pairingMethod] ?? g.pairingMethod}`
    );
    return parts.length > 0 ? `แยกกลุ่ม (${parts.join(" · ")})` : "แยกกลุ่ม";
  }
  return round.pairingMethod ? (PAIRING_METHOD_LABEL[round.pairingMethod] ?? round.pairingMethod) : "—";
}

export const STAFF_STATUS_BADGE: Record<string, { label: string; variant: BadgeVariant }> = {
  INVITED: { label: "รอตอบรับ", variant: "warning" },
  ACTIVE: { label: "ใช้งาน", variant: "success" },
  DECLINED: { label: "ปฏิเสธแล้ว", variant: "neutral" },
  REVOKED: { label: "ถูกถอดแล้ว", variant: "neutral" },
};

export const TOURNAMENT_STATUS_BADGE: Record<string, { label: string; variant: BadgeVariant }> = {
  UPCOMING: { label: "เร็ว ๆ นี้", variant: "warning" },
  ONGOING: { label: "กำลังแข่งขัน", variant: "success" },
  COMPLETED: { label: "จบแล้ว", variant: "neutral" },
};

export const ROUND_STATUS_BADGE: Record<string, { label: string; variant: BadgeVariant }> = {
  DRAFT: { label: "Draft", variant: "neutral" },
  PREVIEW: { label: "Preview", variant: "warning" },
  CONFIRMED: { label: "กำลังแข่ง", variant: "success" },
  COMPLETED: { label: "จบแล้ว", variant: "neutral" },
};

export const MATCH_STATUS_BADGE: Record<string, { label: string; variant: BadgeVariant }> = {
  PENDING: { label: "รอผล", variant: "neutral" },
  SUBMITTED: { label: "รอยืนยัน", variant: "warning" },
  CONFLICT: { label: "ผลไม่ตรงกัน", variant: "danger" },
  CONFIRMED: { label: "ยืนยันแล้ว", variant: "success" },
  BYE: { label: "Bye", variant: "neutral" },
};

export const PLAYER_STATUS_BADGE: Record<string, { label: string; variant: BadgeVariant }> = {
  ACTIVE: { label: "Active", variant: "success" },
  WITHDRAWN: { label: "Withdrawn", variant: "neutral" },
};

export const MATCH_OUTCOME_BADGE: Record<"WIN" | "TIE" | "LOSS", { label: string; variant: BadgeVariant }> = {
  WIN: { label: "W", variant: "success" },
  TIE: { label: "T", variant: "warning" },
  LOSS: { label: "L", variant: "danger" },
};
