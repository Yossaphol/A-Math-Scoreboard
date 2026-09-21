type BadgeVariant = "neutral" | "accent" | "success" | "warning" | "danger";

export const TOURNAMENT_STATUS_BADGE: Record<string, { label: string; variant: BadgeVariant }> = {
  UPCOMING: { label: "เร็ว ๆ นี้", variant: "neutral" },
  ONGOING: { label: "กำลังแข่งขัน", variant: "accent" },
  COMPLETED: { label: "จบแล้ว", variant: "success" },
};

export const ROUND_STATUS_BADGE: Record<string, { label: string; variant: BadgeVariant }> = {
  DRAFT: { label: "Draft", variant: "neutral" },
  PREVIEW: { label: "Preview", variant: "warning" },
  CONFIRMED: { label: "กำลังแข่ง", variant: "accent" },
  COMPLETED: { label: "จบแล้ว", variant: "success" },
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
