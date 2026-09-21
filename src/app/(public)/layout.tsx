import Link from "next/link";
import { getSession } from "@/lib/dal";
import { LinkButton } from "@/components/ui/Button";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  return (
    <div className="min-h-screen">
      <header className="border-b border-neutral-200/70 bg-white/50 backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <Link href="/" className="text-sm font-semibold tracking-tight text-neutral-900">
            Score A-Math
          </Link>
          {session?.user ? (
            <LinkButton href="/account" variant="secondary" size="sm">
              {session.user.name || session.user.email}
            </LinkButton>
          ) : (
            <LinkButton href="/login?callbackUrl=/account" variant="secondary" size="sm">
              User
            </LinkButton>
          )}
        </div>
      </header>
      {children}
    </div>
  );
}
