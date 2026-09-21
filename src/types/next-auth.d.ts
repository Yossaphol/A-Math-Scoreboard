import type { Role } from "@/generated/prisma/enums";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
      name?: string | null;
      email?: string | null;
    };
  }

  interface User {
    // Only set by the Credentials provider's authorize() — Google sign-ins don't know our
    // role, so auth.ts looks it up from the DB by email instead (see the jwt callback).
    role?: Role;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: Role;
  }
}
