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
      <div className="min-h-screen bg-[#FAF7F2] text-[#2B261F] font-[system-ui] flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center">
          <h1 className="text-xl font-semibold mb-3">Password updated</h1>
          <p className="text-sm text-[#6B6357] mb-6">You can sign in with your new password now.</p>
          <button
            onClick={() => router.push("/login")}
            className="text-sm px-4 py-2 rounded-xl bg-[#5FC2AB] text-[#FAF7F2] shadow-md shadow-[#5FC2AB]/25 font-medium"
          >
            Go to sign in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-[#2B261F] font-[system-ui] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-xl font-semibold mb-1 text-center">Reset password</h1>
        <p className="text-xs text-[#6B6357] text-center mb-6">
          Sets a new password directly on an existing account. Needs the admin token.
        </p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs text-[#6B6357] mb-1">Admin token</label>
            <input
              type="password"
              autoComplete="off"
              required
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className="w-full bg-[#FFFFFF] border border-[#E2DCD0] rounded-xl px-3 py-2 text-sm outline-none shadow-sm focus:border-[#2E9C86] focus:shadow-md transition-shadow"
            />
          </div>
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
            <label className="block text-xs text-[#6B6357] mb-1">New password</label>
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
            {submitting ? <Spinner label="Updating…" /> : "Set new password"}
          </button>
        </form>
      </div>
    </div>
  );
}
