import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";

// Temporary bootstrapping endpoint — see /reset-password. Gated by ADMIN_SECRET so this can only
// be called by someone who already has that value (shared out-of-band, not baked into the page).
// Remove this route once it's no longer needed; a permanent password-reset flow belongs behind
// an email-verification step, which this intentionally is not.
export async function POST(req: Request) {
  const secret = process.env.ADMIN_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!email.includes("@") || password.length < 8) {
    return Response.json(
      { error: "A valid email and a password of at least 8 characters are required" },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return Response.json({ error: "No account with that email — use /signup instead" }, { status: 404 });
  }

  const passwordHash = await hashPassword(password);
  await prisma.user.update({ where: { email }, data: { passwordHash } });

  return Response.json({ ok: true });
}
