import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/generated/prisma/enums";

export const { handlers, signIn, signOut, auth } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  // Self-hosted (no NEXTAUTH_URL/AUTH_URL fixed) — trust the request's Host header to build
  // the callback URL. Safe for local dev / a single known deployment; see README for the
  // exact Google Cloud Console redirect URI this callback URL must match.
  trustHost: true,
  providers: [
    // Spec §4/§5: this is how BOTH regular Users and pre-added Admin/Staff sign in — an
    // Admin/Staff account already exists (added by Gmail beforehand), a plain User account
    // is created on first login (see the signIn callback below).
    Google,
    // Dev-only fallback so this can be exercised locally without real Google OAuth
    // credentials configured — see AUTH_GOOGLE_ID/SECRET in .env. Excluded entirely in
    // production: prisma/seed.ts writes a password-login admin using a hardcoded dev
    // password, and that must never be a reachable login path outside local dev, even if
    // the seed script is ever accidentally run against a shared/production database.
    ...(process.env.NODE_ENV === "production"
      ? []
      : [
          Credentials({
            credentials: {
              email: { label: "Email", type: "email" },
              password: { label: "Password", type: "password" },
            },
            authorize: async (credentials) => {
              const email = credentials?.email;
              const password = credentials?.password;
              if (typeof email !== "string" || typeof password !== "string") {
                return null;
              }

              const user = await prisma.user.findUnique({ where: { email } });
              if (!user?.passwordHash) return null;

              const valid = await bcrypt.compare(password, user.passwordHash);
              if (!valid) return null;

              return { id: user.id, email: user.email, name: user.name, role: user.role };
            },
          }),
        ]),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "google") {
        if (!user.email) return false;
        // First-time Google sign-in for a plain User is auto-provisioned (spec §4 — no
        // separate sign-up step). An Admin/Staff row must already exist from Admin
        // Management / Staff Assignment; this upsert never touches an existing role.
        await prisma.user.upsert({
          where: { email: user.email },
          update: { name: user.name ?? undefined },
          create: { email: user.email, name: user.name, role: "USER" },
        });
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        if (user.role) {
          token.id = user.id as string;
          token.role = user.role;
        } else if (user.email) {
          const dbUser = await prisma.user.findUnique({ where: { email: user.email } });
          if (dbUser) {
            token.id = dbUser.id;
            token.role = dbUser.role;
          }
        }
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id as string;
      session.user.role = token.role as Role;
      return session;
    },
  },
});
