"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Spinner from "@/components/Spinner";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Something went wrong");
        return;
      }
      router.push("/");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-[#2B261F] font-[system-ui] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-xl font-semibold mb-6 text-center">Create your account</h1>
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
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[#FFFFFF] border border-[#E2DCD0] rounded-xl px-3 py-2 text-sm outline-none shadow-sm focus:border-[#2E9C86] focus:shadow-md transition-shadow"
            />
            <p className="text-xs text-[#6B6357] mt-1">At least 8 characters.</p>
          </div>
          {error && <p className="text-xs text-[#D14F3F]">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="w-full flex items-center justify-center text-sm px-3 py-2 rounded-xl bg-[#5FC2AB] text-[#FAF7F2] shadow-md shadow-[#5FC2AB]/25 font-medium disabled:opacity-50"
          >
            {submitting ? <Spinner label="Creating account…" /> : "Sign up"}
          </button>
        </form>
        <p className="text-xs text-[#6B6357] text-center mt-4">
          Already have an account?{" "}
          <Link href="/login" className="text-[#2E9C86]">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
