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
    <div className="min-h-screen bg-[#16181A] text-[#EDEAE3] font-[system-ui] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-xl font-semibold mb-6 text-center">Create your account</h1>
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
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[#1B1D1F] border border-[#2E3236] rounded-md px-3 py-2 text-sm outline-none focus:border-[#7DD3C0]"
            />
            <p className="text-xs text-[#9AA5B1] mt-1">At least 8 characters.</p>
          </div>
          {error && <p className="text-xs text-[#E8574B]">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="w-full flex items-center justify-center text-sm px-3 py-2 rounded-md bg-[#7DD3C0] text-[#16181A] font-medium disabled:opacity-50"
          >
            {submitting ? <Spinner label="Creating account…" /> : "Sign up"}
          </button>
        </form>
        <p className="text-xs text-[#9AA5B1] text-center mt-4">
          Already have an account?{" "}
          <Link href="/login" className="text-[#7DD3C0]">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
