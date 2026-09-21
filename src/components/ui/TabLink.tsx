"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function TabLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const active = pathname === href;

  return (
    <Link
      href={href}
      className={`relative px-3 py-2.5 text-sm transition-colors ${
        active ? "font-medium text-neutral-900" : "text-neutral-500 hover:text-neutral-900"
      }`}
    >
      {children}
      {active && <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-neutral-900" />}
    </Link>
  );
}
