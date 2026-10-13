"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavIcon = "overview" | "competition" | "people";
// badge: how many things on that page are waiting on someone (e.g. pending Account Requests).
export type NavItem = { href: string; label: string; exact?: boolean; badge?: number };
export type NavGroup = { id: string; label: string; icon: NavIcon; items: NavItem[] };

// Which groups this device has collapsed, kept as a JSON string so the snapshot stays stable.
// localStorage can be missing or throw — then nothing is remembered and every group starts open.
const COLLAPSED_KEY = "admin-nav:collapsed";
const listeners = new Set<() => void>();
let collapsedRaw: string | null = null;

function readCollapsed() {
  if (collapsedRaw === null) {
    try {
      collapsedRaw = localStorage.getItem(COLLAPSED_KEY) ?? "[]";
    } catch {
      collapsedRaw = "[]";
    }
  }
  return collapsedRaw;
}

function writeCollapsed(ids: string[]) {
  collapsedRaw = JSON.stringify(ids);
  try {
    localStorage.setItem(COLLAPSED_KEY, collapsedRaw);
  } catch {}
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function parseIds(raw: string): string[] {
  try {
    const ids = JSON.parse(raw);
    return Array.isArray(ids) ? ids : [];
  } catch {
    return [];
  }
}

function isActive(pathname: string, item: NavItem) {
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
}

// Same red count as the notification bell; screen readers hear the label after the link's name.
function CountBadge({ count, label }: { count: number; label: string }) {
  return (
    <span className="flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold tabular-nums leading-none text-white">
      <span aria-hidden="true">{count > 99 ? "99+" : count}</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}

function ItemLabel({ item }: { item: NavItem }) {
  return (
    <>
      <span className="truncate">{item.label}</span>
      {!!item.badge && <CountBadge count={item.badge} label={`รอดำเนินการ ${item.badge} รายการ`} />}
    </>
  );
}

function GroupIcon({ icon }: { icon: NavIcon }) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className: "size-[18px] shrink-0",
    "aria-hidden": true,
  };
  if (icon === "overview") {
    return (
      <svg {...common}>
        <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
        <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
        <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
        <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
      </svg>
    );
  }
  if (icon === "competition") {
    return (
      <svg {...common}>
        <path d="M8 4h8v5a4 4 0 01-8 0V4z" />
        <path d="M16 6h3v1.5A3.5 3.5 0 0115.7 11M8 6H5v1.5A3.5 3.5 0 008.3 11M12 13v4M8.5 20h7M10 17h4" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 19a5.5 5.5 0 0111 0M16 5.2a3 3 0 010 5.6M17.5 14.2A5.5 5.5 0 0120.5 19" />
    </svg>
  );
}

/**
 * Admin sidebar navigation: pages grouped by what they're for, each group collapsible (the
 * choice is remembered per device). On narrow screens it's one scrollable row of all pages.
 */
export function AdminNav({ groups }: { groups: NavGroup[] }) {
  const pathname = usePathname();
  const rowRef = useRef<HTMLElement>(null);

  // The phone menu is one sideways-scrolling row — keep the current page in view, or it can
  // sit off the edge (e.g. "กรอกผล" at the far right).
  useEffect(() => {
    const row = rowRef.current;
    const active = row?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!row || !active || row.offsetParent === null) return;
    row.scrollTo({ left: active.offsetLeft - (row.clientWidth - active.offsetWidth) / 2, behavior: "smooth" });
  }, [pathname]);
  const collapsed = new Set(parseIds(useSyncExternalStore(subscribe, readCollapsed, () => "[]")));

  function toggle(id: string) {
    const next = new Set(collapsed);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    writeCollapsed([...next]);
  }

  const itemClass = (active: boolean) =>
    `flex items-center justify-between gap-2 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm transition-colors ${
      active ? "bg-neutral-900 font-medium text-white" : "text-neutral-600 hover:bg-black/5 hover:text-neutral-900"
    }`;

  return (
    <>
      {/* Narrow screens: every page in one row. */}
      <nav ref={rowRef} className="relative flex gap-1 overflow-x-auto px-4 pb-3 [scrollbar-width:none] md:hidden [&::-webkit-scrollbar]:hidden" aria-label="เมนู Admin">
        {groups.flatMap((g) => g.items).map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive(pathname, item) ? "page" : undefined}
            className={`shrink-0 ${itemClass(isActive(pathname, item))}`}
          >
            <ItemLabel item={item} />
          </Link>
        ))}
      </nav>

      <nav className="mt-5 hidden flex-1 flex-col gap-1 overflow-y-auto px-3 md:flex" aria-label="เมนู Admin">
        {groups.map((g) => {
          const open = !collapsed.has(g.id);
          const hasActive = g.items.some((i) => isActive(pathname, i));
          // A collapsed group still shows that something inside is waiting.
          const hiddenCount = open ? 0 : g.items.reduce((sum, i) => sum + (i.badge ?? 0), 0);
          return (
            <div key={g.id}>
              <button
                type="button"
                onClick={() => toggle(g.id)}
                aria-expanded={open}
                className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-black/5 ${
                  hasActive ? "font-semibold text-neutral-900" : "font-medium text-neutral-700"
                }`}
              >
                <GroupIcon icon={g.icon} />
                <span className="flex-1">{g.label}</span>
                {hiddenCount > 0 && <CountBadge count={hiddenCount} label={`รอดำเนินการ ${hiddenCount} รายการ`} />}
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  className={`size-4 text-neutral-400 transition-transform ${open ? "rotate-180" : ""}`}
                  aria-hidden="true"
                >
                  <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              {open && (
                <div className="mb-1 ml-[19px] mt-0.5 space-y-0.5 border-l border-neutral-200 pl-3">
                  {g.items.map((item) => {
                    const active = isActive(pathname, item);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        className={itemClass(active)}
                      >
                        <ItemLabel item={item} />
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </>
  );
}
