import { requireStaffOrAdmin } from "@/lib/dal";
import { logoutAction } from "@/lib/actions/auth";
import { Badge } from "@/components/ui/Badge";
import { buttonBase, SIZES, VARIANTS } from "@/components/ui/Button";
import { AdminNav, type NavGroup } from "@/components/admin/AdminNav";
import { OnlineStaffButton } from "@/components/admin/OnlineStaffButton";
import { NotificationBell } from "@/components/ui/alerts/NotificationBell";
import { RefereeCallAlerts } from "@/components/ui/alerts/RefereeCallAlerts";
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
];

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
  const nav = user.role === "ADMIN" ? ADMIN_NAV : STAFF_NAV;

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      {/* z-30: the sidebar is its own stacking layer (sticky + backdrop blur), so without it the
          page content paints over the notification panel that opens out of it. */}
      <aside className="relative z-30 flex shrink-0 flex-col border-b border-neutral-200/70 bg-white/70 backdrop-blur-md md:sticky md:top-0 md:h-screen md:w-60 md:border-b-0 md:border-r">
        <div className="flex items-center justify-between gap-3 px-4 py-3 md:pb-0 md:pt-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-neutral-900">Score A-Math</p>
            <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-neutral-500">
              <span className="truncate">{user.name || user.email}</span>
              <Badge variant={user.role === "ADMIN" ? "danger" : "info"}>{user.role}</Badge>
            </p>
          </div>
          <NotificationBell className="hidden shrink-0 md:block" align="left" />
          {/* Narrow screens: the same two actions as icon buttons next to the bell. */}
          <div className="flex shrink-0 items-center gap-1.5 md:hidden">
            <NotificationBell />
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

        <div className="px-4 pb-2 md:pb-0 md:pt-3">
          <OnlineStaffButton currentUserId={user.id} />
        </div>

        <AdminNav groups={nav} />

        <div className="hidden space-y-2 border-t border-neutral-200/70 p-3 md:block">
          {/* Counterpart of the "ไปหน้า Admin" item in the public site's user menu. */}
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
      <RefereeCallAlerts />
    </div>
  );
}
