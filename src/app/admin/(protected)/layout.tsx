import { requireStaffOrAdmin } from "@/lib/dal";
import { logoutAction } from "@/lib/actions/auth";
import { Badge } from "@/components/ui/Badge";
import { buttonBase, SIZES, VARIANTS } from "@/components/ui/Button";
import { AdminNav, type NavGroup } from "@/components/admin/AdminNav";
import { OnlineStaffButton } from "@/components/admin/OnlineStaffButton";
import { getInbox } from "@/lib/notifications";
import { NotificationBell } from "@/components/ui/alerts/NotificationBell";
import { RefereeCallAlerts } from "@/components/ui/alerts/RefereeCallAlerts";
import { getSystemSettings } from "@/lib/system-settings";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

const SCORE_ENTRY = { href: "/admin/score-entry", label: "กรอกผล" };

const ADMIN_NAV: NavGroup[] = [
  {
    id: "overview",
    label: "ภาพรวม",
    icon: "overview",
    items: [
      { href: "/admin", label: "Dashboard", exact: true },
      { href: "/admin/audit-log", label: "Audit Log" },
      { href: "/admin/settings", label: "ตั้งค่า" },
    ],
  },
  {
    id: "competition",
    label: "การแข่งขัน",
    icon: "competition",
    items: [{ href: "/admin/tournaments", label: "Tournaments" }, SCORE_ENTRY],
  },
  {
    id: "people",
    label: "ผู้เล่น & ทีมงาน",
    icon: "people",
    items: [
      { href: "/admin/players", label: "Players" },
      { href: "/admin/staff", label: "Staff" },
      { href: "/admin/account-requests", label: "Account Requests" },
      { href: "/admin/admins", label: "Admins" },
    ],
  },
];

const STAFF_NAV: NavGroup[] = [
  {
    id: "competition",
    label: "การแข่งขัน",
    icon: "competition",
    items: [{ href: "/admin", label: "My Tournaments", exact: true }, SCORE_ENTRY],
  },
  {
    id: "overview",
    label: "อื่น ๆ",
    icon: "overview",
    // Staff only get this device's switches there (sound, popups) — not the system ones.
    items: [{ href: "/admin/settings", label: "ตั้งค่า" }],
  },
];

function withBadges(groups: NavGroup[], badges: Record<string, number>): NavGroup[] {
  return groups.map((g) => ({ ...g, items: g.items.map((i) => ({ ...i, badge: badges[i.href] })) }));
}

function UserSiteIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="size-4 shrink-0" aria-hidden="true">
      <path
        d="M4 11.5L12 5l8 6.5V19a1 1 0 01-1 1h-4.5v-5h-5v5H5a1 1 0 01-1-1v-7.5z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ScreenIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="size-4 shrink-0" aria-hidden="true">
      <rect x="3" y="4" width="18" height="12" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 20h8M12 16v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="size-4 shrink-0" aria-hidden="true">
      <path
        d="M14 4h4a2 2 0 012 2v12a2 2 0 01-2 2h-4M10 16l-4-4 4-4M6 12h10"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default async function AdminProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireStaffOrAdmin();
  const isAdmin = user.role === "ADMIN";
  const [inbox, { liveFeedEnabled }, pendingLinkRequests] = await Promise.all([
    getInbox(user.id),
    getSystemSettings(),
    // One indexed COUNT per page load (LinkRequest @@index([status])), refreshed on navigation.
    isAdmin ? prisma.linkRequest.count({ where: { status: "PENDING" } }) : 0,
  ]);
  const nav = isAdmin ? withBadges(ADMIN_NAV, { "/admin/account-requests": pendingLinkRequests }) : STAFF_NAV;

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      {/* z-30: the sidebar is its own stacking layer (sticky + backdrop blur), so without it the
          page content paints over the notification panel that opens out of it. */}
      <aside className="relative z-30 flex shrink-0 flex-col border-b border-neutral-200/70 bg-white/70 backdrop-blur-md md:sticky md:top-0 md:h-screen md:w-60 md:border-b-0 md:border-r">
        <div className="relative flex items-center justify-between gap-3 px-4 py-3 md:pb-0 md:pt-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-neutral-900">Score A-Math</p>
            <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-neutral-500">
              <span className="truncate">{user.name || user.email}</span>
              <Badge variant={user.role === "ADMIN" ? "danger" : "info"}>{user.role}</Badge>
            </p>
          </div>
          <NotificationBell className="hidden shrink-0 md:block" align="left" inbox={inbox} settingsHref="/admin/settings" />
          {/* Narrow screens: the same two actions as icon buttons next to the bell. */}
          <div className="flex shrink-0 items-center gap-1.5 md:hidden">
            <NotificationBell inbox={inbox} settingsHref="/admin/settings" />
            <Link
              href="/admin/screen"
              target="_blank"
              aria-label="เปิดจอห้องแข่ง"
              title="เปิดจอห้องแข่ง"
              className="flex size-9 items-center justify-center rounded-full border border-neutral-200 bg-white/80 text-neutral-600 hover:border-neutral-300 hover:text-neutral-900"
            >
              <ScreenIcon />
            </Link>
            <Link
              href="/"
              aria-label="ไปหน้า User"
              title="ไปหน้า User"
              className="flex size-9 items-center justify-center rounded-full border border-neutral-200 bg-white/80 text-neutral-600 hover:border-neutral-300 hover:text-neutral-900"
            >
              <UserSiteIcon />
            </Link>
            <form action={logoutAction}>
              <button
                type="submit"
                aria-label="ออกจากระบบ"
                title="ออกจากระบบ"
                className="flex size-9 items-center justify-center rounded-full border border-neutral-200 bg-white/80 text-neutral-600 hover:border-red-200 hover:text-danger"
              >
                <LogoutIcon />
              </button>
            </form>
          </div>
        </div>

        {/* "Who's online" comes from the live feed — nothing to show while it's switched off. */}
        {liveFeedEnabled && (
          <div className="px-4 pb-2 md:pb-0 md:pt-3">
            <OnlineStaffButton currentUserId={user.id} />
          </div>
        )}

        <AdminNav groups={nav} />

        <div className="hidden space-y-2 border-t border-neutral-200/70 p-3 md:block">
          {/* Counterpart of the "ไปหน้า Admin" item in the public site's user menu. */}
          {/* New tab: it's meant for the TV/projector in the hall. */}
          <Link
            href="/admin/screen"
            target="_blank"
            className={`${buttonBase} ${VARIANTS.secondary} ${SIZES.md} w-full justify-start`}
          >
            <ScreenIcon />
            เปิดจอห้องแข่ง
            <span className="ml-auto text-neutral-400">↗</span>
          </Link>
          <Link href="/" className={`${buttonBase} ${VARIANTS.secondary} ${SIZES.md} w-full justify-start`}>
            <UserSiteIcon />
            ไปหน้า User
          </Link>
          <form action={logoutAction}>
            <button
              type="submit"
              className={`${buttonBase} ${SIZES.md} w-full justify-start text-neutral-600 hover:bg-red-50 hover:text-danger`}
            >
              <LogoutIcon />
              ออกจากระบบ
            </button>
          </form>
        </div>
      </aside>
      <div className="min-w-0 flex-1 p-4 md:p-8">{children}</div>
      {liveFeedEnabled && <RefereeCallAlerts />}
    </div>
  );
}
