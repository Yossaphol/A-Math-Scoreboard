import { requireStaffOrAdmin } from "@/lib/dal";
import { logoutAction } from "@/lib/actions/auth";
import { NavLink } from "@/components/ui/NavLink";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

const ADMIN_NAV = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/tournaments", label: "Tournaments" },
  { href: "/admin/players", label: "Players" },
  { href: "/admin/staff", label: "Staff" },
  { href: "/admin/account-requests", label: "Account Requests" },
  { href: "/admin/admins", label: "Admins" },
  { href: "/admin/audit-log", label: "Audit Log" },
];

const STAFF_NAV = [{ href: "/admin", label: "My Tournaments" }];

export default async function AdminProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireStaffOrAdmin();
  const nav = user.role === "ADMIN" ? ADMIN_NAV : STAFF_NAV;

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="flex shrink-0 flex-col border-b border-neutral-200/70 bg-white/70 backdrop-blur-md md:sticky md:top-0 md:h-screen md:w-60 md:border-b-0 md:border-r">
        <div className="flex items-center justify-between gap-3 px-4 py-3 md:block md:pb-0 md:pt-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-neutral-900">Score A-Math</p>
            <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-neutral-500">
              <span className="truncate">{user.name || user.email}</span>
              <Badge variant={user.role === "ADMIN" ? "danger" : "info"}>{user.role}</Badge>
            </p>
          </div>
          <form action={logoutAction} className="shrink-0 md:hidden">
            <Button type="submit" variant="ghost" size="sm">
              Logout
            </Button>
          </form>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-4 pb-3 md:mt-6 md:flex-1 md:flex-col md:space-y-1 md:overflow-visible md:pb-0">
          {nav.map((item) => (
            <NavLink key={item.href} href={item.href} exact={item.href === "/admin"}>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <form action={logoutAction} className="hidden p-4 md:block">
          <Button type="submit" variant="ghost" size="sm" className="w-full justify-start">
            Logout
          </Button>
        </form>
      </aside>
      <div className="min-w-0 flex-1 p-4 md:p-8">{children}</div>
    </div>
  );
}
