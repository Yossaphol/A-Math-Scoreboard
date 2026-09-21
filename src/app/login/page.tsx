import { loginAction, googleLoginAction } from "@/lib/actions/auth";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

function safeCallback(raw: string | string[] | undefined): string {
  if (typeof raw === "string" && raw.startsWith("/")) return raw;
  return "/admin";
}

export default async function LoginPage(props: PageProps<"/login">) {
  const { error, callbackUrl } = await props.searchParams;
  const redirectTo = safeCallback(callbackUrl);
  // The Credentials provider itself is excluded in production (see src/auth.ts) — don't
  // show a login form that can never actually work there.
  const showDevLogin = process.env.NODE_ENV !== "production";

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4">
      <Card>
        <h1 className="text-xl font-semibold text-neutral-900">เข้าสู่ระบบ</h1>
        <p className="mt-1 text-sm text-neutral-500">
          ผูก Google Account กับ Global Player ID หรือเข้าสู่ระบบ Admin/Staff
        </p>

        {error && (
          <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-danger">
            อีเมลหรือรหัสผ่านไม่ถูกต้อง
          </p>
        )}

        <form action={googleLoginAction} className="mt-6">
          <input type="hidden" name="callbackUrl" value={redirectTo} />
          <Button type="submit" variant="secondary" className="w-full">
            เข้าสู่ระบบด้วย Google
          </Button>
        </form>

        {showDevLogin && (
          <>
            <div className="my-5 flex items-center gap-3 text-xs text-neutral-400">
              <span className="h-px flex-1 bg-neutral-200" />
              หรือ (สำหรับ Dev)
              <span className="h-px flex-1 bg-neutral-200" />
            </div>

            <form action={loginAction} className="space-y-4">
              <input type="hidden" name="callbackUrl" value={redirectTo} />
              <div>
                <label htmlFor="email" className="text-xs text-neutral-500">
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  className="mt-1 w-full rounded-lg border border-neutral-200 bg-white/70 px-3 py-2 text-sm outline-none focus:border-accent"
                />
              </div>
              <div>
                <label htmlFor="password" className="text-xs text-neutral-500">
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  className="mt-1 w-full rounded-lg border border-neutral-200 bg-white/70 px-3 py-2 text-sm outline-none focus:border-accent"
                />
              </div>
              <Button type="submit" variant="primary" className="w-full">
                Login
              </Button>
            </form>
          </>
        )}
      </Card>
    </main>
  );
}
