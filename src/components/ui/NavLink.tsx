"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLink({
  href,
  children,
  exact = false,
}: {
  href: string;
  children: React.ReactNode;
  exact?: boolean;
}) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      className={`block shrink-0 whitespace-nowrap rounded-lg px-3 py-2 text-sm transition-colors ${
        active
          ? "bg-neutral-900 text-white font-medium"
          : "text-neutral-600 hover:bg-black/5 hover:text-neutral-900"
      }`}
    >
      {children}
    </Link>
  );
}
