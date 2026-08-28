import type { NextAuthConfig } from "next-auth";

// Edge-safe config (no Prisma/bcrypt) — used directly by middleware, and spread into the full
// config in auth.ts which adds the Credentials provider. Keeping providers out of this file is
// what makes it safe to import in the Edge runtime.
const PUBLIC_PATHS = new Set([
  "/login",
  "/signup",
  "/reset-password",
  "/api/admin/reset-password", // gated by its own ADMIN_SECRET check, not a session
  "/manifest.webmanifest",
  "/icon.svg",
  "/icon-192.png",
  "/icon-512.png",
  "/apple-touch-icon.png",
]);

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true;
  if (pathname.startsWith("/api/auth/")) return true; // Auth.js's own routes
  if (pathname.startsWith("/api/cron/")) return true; // own CRON_SECRET check
  return false;
}

export const authConfig: NextAuthConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      if (isPublicPath(pathname)) return true;
      if (auth?.user) return true;

      if (pathname.startsWith("/api/")) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }
      return false; // NextAuth redirects to `pages.signIn`, preserving the original URL as callbackUrl
    },
  },
};
