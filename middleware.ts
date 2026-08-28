import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

// Deliberately a separate, minimal NextAuth instance from the one in auth.ts — this one has no
// providers (Credentials pulls in Prisma/bcrypt, which aren't Edge-runtime safe), so it's only
// used here to read/validate the session cookie via the `authorized` callback in auth.config.ts.
export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
