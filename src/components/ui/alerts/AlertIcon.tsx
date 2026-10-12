import type { AlertType } from "./store";

export const ALERT_TONE: Record<AlertType, { icon: string; glow: string; bar: string; ring: string }> = {
  info: { icon: "text-sky-500", glow: "rgba(14, 165, 233, 0.16)", bar: "bg-sky-500", ring: "ring-sky-400/60" },
  success: { icon: "text-emerald-500", glow: "rgba(16, 185, 129, 0.16)", bar: "bg-emerald-500", ring: "ring-emerald-400/60" },
  warning: { icon: "text-amber-500", glow: "rgba(245, 158, 11, 0.2)", bar: "bg-amber-500", ring: "ring-amber-400/70" },
  error: { icon: "text-red-500", glow: "rgba(239, 68, 68, 0.16)", bar: "bg-red-500", ring: "ring-red-400/60" },
};

export function AlertGlyph({ type, className = "size-5" }: { type: AlertType; className?: string }) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className: `${className} ${ALERT_TONE[type].icon}`,
    "aria-hidden": true,
  };
  if (type === "success") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="9" />
        <path d="M8 12.5l2.7 2.7L16 9.8" />
      </svg>
    );
  }
  if (type === "warning") {
    return (
      <svg {...common}>
        <path d="M10.3 4.2L2.8 17.3A2 2 0 004.5 20.3h15a2 2 0 001.7-3L13.7 4.2a2 2 0 00-3.4 0z" />
        <path d="M12 9.5v4M12 16.8v.01" />
      </svg>
    );
  }
  if (type === "error") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7.5v5.5M12 16.3v.01" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5.5M12 7.7v.01" />
    </svg>
  );
}

/** The white rounded tile the glyph sits in, as in the alert cards. */
export function AlertIconTile({ type, size = "md" }: { type: AlertType; size?: "sm" | "md" }) {
  const box = size === "sm" ? "size-8 rounded-lg" : "size-10 rounded-xl";
  return (
    <span
      className={`flex ${box} shrink-0 items-center justify-center bg-white shadow-[0_1px_3px_rgba(16,24,40,0.08)] ring-1 ring-black/[0.03]`}
    >
      <AlertGlyph type={type} className={size === "sm" ? "size-4" : "size-5"} />
    </span>
  );
}
