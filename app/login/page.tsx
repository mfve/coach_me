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
    <div className="min-h-screen bg-[#16181A] text-[#EDEAE3] font-[system-ui] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-xl font-semibold mb-6 text-center">Coach Me</h1>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs text-[#9AA5B1] mb-1">Email</label>
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-[#1B1D1F] border border-[#2E3236] rounded-md px-3 py-2 text-sm outline-none focus:border-[#7DD3C0]"
            />
          </div>
          <div>
            <label className="block text-xs text-[#9AA5B1] mb-1">Password</label>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[#1B1D1F] border border-[#2E3236] rounded-md px-3 py-2 text-sm outline-none focus:border-[#7DD3C0]"
            />
          </div>
          {error && <p className="text-xs text-[#E8574B]">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="w-full flex items-center justify-center text-sm px-3 py-2 rounded-md bg-[#7DD3C0] text-[#16181A] font-medium disabled:opacity-50"
          >
            {submitting ? <Spinner label="Signing in…" /> : "Sign in"}
          </button>
        </form>
        <p className="text-xs text-[#9AA5B1] text-center mt-4">
          No account?{" "}
          <Link href="/signup" className="text-[#7DD3C0]">
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
