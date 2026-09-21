import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/auth";

// Optimistic check only (Next.js 16 guidance): the real enforcement lives in
// src/lib/dal.ts and runs again on every page/action/route (spec §5).
export async function proxy(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Optimistic mirror of the requireStaffOrAdmin check in dal.ts: a plain USER (e.g. a
  // Google sign-in that never got an Admin/Staff role) must never see the admin shell.
  if (session.user.role !== "ADMIN" && session.user.role !== "STAFF") {
    return NextResponse.redirect(new URL("/", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
