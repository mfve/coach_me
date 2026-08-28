"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";
import Spinner from "@/components/Spinner";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await signIn("credentials", { email, password, redirect: false });
      if (res?.error) {
        setError("Invalid email or password");
        return;
      }
      router.push(searchParams.get("callbackUrl") || "/");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-[#2B261F] font-[system-ui] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-xl font-semibold mb-6 text-center">Coach Me</h1>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs text-[#6B6357] mb-1">Email</label>
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-[#FFFFFF] border border-[#E2DCD0] rounded-xl px-3 py-2 text-sm outline-none shadow-sm focus:border-[#2E9C86] focus:shadow-md transition-shadow"
            />
          </div>
          <div>
            <label className="block text-xs text-[#6B6357] mb-1">Password</label>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[#FFFFFF] border border-[#E2DCD0] rounded-xl px-3 py-2 text-sm outline-none shadow-sm focus:border-[#2E9C86] focus:shadow-md transition-shadow"
            />
          </div>
          {error && <p className="text-xs text-[#D14F3F]">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="w-full flex items-center justify-center text-sm px-3 py-2 rounded-xl bg-[#5FC2AB] text-[#FAF7F2] shadow-md shadow-[#5FC2AB]/25 font-medium disabled:opacity-50"
          >
            {submitting ? <Spinner label="Signing in…" /> : "Sign in"}
          </button>
        </form>
        <p className="text-xs text-[#6B6357] text-center mt-4">
          No account?{" "}
          <Link href="/signup" className="text-[#2E9C86]">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
