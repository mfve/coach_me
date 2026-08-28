"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Spinner from "@/components/Spinner";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? `Request failed (${res.status})`);
        return;
      }
      setDone(true);
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="min-h-screen bg-[#16181A] text-[#EDEAE3] font-[system-ui] flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center">
          <h1 className="text-xl font-semibold mb-3">Password updated</h1>
          <p className="text-sm text-[#9AA5B1] mb-6">You can sign in with your new password now.</p>
          <button
            onClick={() => router.push("/login")}
            className="text-sm px-4 py-2 rounded-md bg-[#7DD3C0] text-[#16181A] font-medium"
          >
            Go to sign in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#16181A] text-[#EDEAE3] font-[system-ui] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-xl font-semibold mb-1 text-center">Reset password</h1>
        <p className="text-xs text-[#9AA5B1] text-center mb-6">
          Sets a new password directly on an existing account. Needs the admin token.
        </p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs text-[#9AA5B1] mb-1">Admin token</label>
            <input
              type="password"
              autoComplete="off"
              required
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className="w-full bg-[#1B1D1F] border border-[#2E3236] rounded-md px-3 py-2 text-sm outline-none focus:border-[#7DD3C0]"
            />
          </div>
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
            <label className="block text-xs text-[#9AA5B1] mb-1">New password</label>
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
            {submitting ? <Spinner label="Updating…" /> : "Set new password"}
          </button>
        </form>
      </div>
    </div>
  );
}
