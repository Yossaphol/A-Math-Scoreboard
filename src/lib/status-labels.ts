type BadgeVariant = "neutral" | "accent" | "success" | "warning" | "danger" | "info";

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
