import type { ButtonHTMLAttributes } from "react";
import Link from "next/link";

export const VARIANTS = {
  primary: "bg-neutral-900 text-white hover:bg-neutral-700",
  secondary:
    "bg-white/80 text-neutral-900 border border-neutral-200 hover:bg-white hover:border-neutral-300",
  danger: "bg-danger text-white hover:opacity-90",
  ghost: "text-neutral-600 hover:text-neutral-950 hover:bg-black/5",
} as const;

export const SIZES = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
} as const;

export type Variant = keyof typeof VARIANTS;
export type Size = keyof typeof SIZES;

export const buttonBase =
  "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none";
const base = buttonBase;

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return (
    <button
      className={`${base} ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...props}
    />
  );
}

export function LinkButton({
  href,
  variant = "primary",
  size = "md",
  className = "",
  children,
  target,
}: {
  href: string;
  variant?: Variant;
  size?: Size;
  className?: string;
  children: React.ReactNode;
  target?: string;
}) {
  return (
    <Link
      href={href}
      target={target}
      className={`${base} ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
    >
      {children}
    </Link>
  );
}
