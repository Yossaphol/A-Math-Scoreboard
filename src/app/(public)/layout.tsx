import Link from "next/link";
import { getSession } from "@/lib/dal";
import { LinkButton } from "@/components/ui/Button";
import { UserMenu } from "@/components/account/UserMenu";
import { RefereeCallAlerts } from "@/components/ui/alerts/RefereeCallAlerts";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  const isStaffOrAdmin = session?.user.role === "ADMIN" || session?.user.role === "STAFF";

  return (
    <div className="min-h-screen">
      <header className="border-b border-neutral-200/70 bg-white/50 backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <Link href="/" className="text-sm font-semibold tracking-tight text-neutral-900">
            Score A-Math
          </Link>
          {session?.user ? (
            <UserMenu name={session.user.name || session.user.email || "User"} isStaffOrAdmin={isStaffOrAdmin} />
          ) : (
            <LinkButton href="/login?callbackUrl=/account" variant="secondary" size="sm">
              Login
            </LinkButton>
          )}
        </div>
      </header>
      {children}
      {isStaffOrAdmin && <RefereeCallAlerts />}
    </div>
  );
}
