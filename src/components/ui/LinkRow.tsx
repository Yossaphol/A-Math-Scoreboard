"use client";

import { useRouter } from "next/navigation";

/**
 * A table row that navigates to `href` when clicked anywhere on it. Keep a real <Link> in one
 * of the cells too — that stays the keyboard/screen-reader target and handles middle-click;
 * this only widens the mouse hit area. Ctrl/⌘-click opens a new tab like a normal link.
 */
export function LinkRow({
  href,
  className = "",
  children,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();

  return (
    <tr
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("a, button, input, select, textarea, form")) return;
        if (window.getSelection()?.toString()) return; // let people select text in a cell
        if (e.metaKey || e.ctrlKey) {
          window.open(href, "_blank");
          return;
        }
        router.push(href);
      }}
      onMouseEnter={() => router.prefetch(href)}
      className={`cursor-pointer transition-colors hover:bg-black/[0.02] ${className}`}
    >
      {children}
    </tr>
  );
}
