"use client";

/* ═══════════════════════════════════════════════════════════════════════════
   Login page — standalone (no AppShell, no auth gate).
   Sign-in only: new accounts are created by an admin in Supabase
   (Authentication → Users). Self-service sign-up is intentionally removed.
   Uses Supabase email + password auth. On success, redirects to the dashboard.
═══════════════════════════════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Already logged in? Skip straight to the dashboard.
  useEffect(() => {
    if (typeof window !== "undefined" && localStorage.getItem("demo_bypass") === "true") {
      router.replace("/");
      return;
    }
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace("/");
    });
  }, [router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!supabase) {
      setError("Database is not configured. Add Supabase keys to enable login.");
      return;
    }
    const mail = email.trim();
    if (!mail || !password) {
      setError("Email and password are required.");
      return;
    }

    setLoading(true);
    try {
      const { error: err } = await supabase.auth.signInWithPassword({ email: mail, password });
      if (err) throw err;
      router.replace("/");
    } catch (err) {
      setError((err as Error).message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12 dark:bg-slate-950">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/25">
            <span className="text-lg font-bold tracking-tight">PI</span>
          </div>
          <h1 className="mt-4 text-xl font-semibold text-slate-900 dark:text-white">People Intelligence</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Sign in to your workspace</p>
        </div>

        {/* Card */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className={inputClass}
              />
            </div>

            {error && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-950 dark:text-red-300">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 disabled:pointer-events-none disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
            >
              {loading ? "Please wait…" : "Sign in"}
            </button>
          </form>

          <div className="mt-6 border-t border-slate-200/60 pt-5 dark:border-slate-800">
            <button
              type="button"
              onClick={() => {
                if (typeof window !== "undefined") {
                  localStorage.setItem("demo_bypass", "true");
                }
                router.replace("/");
              }}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-500/25 transition-all duration-200 hover:from-emerald-500 hover:to-teal-500 hover:scale-[1.02] active:scale-[0.98]"
            >
              <span>🚀 Masuk Tanpa Login (Mode Demo VALORA TV)</span>
            </button>
            <p className="mt-2.5 text-center text-xs text-slate-500 dark:text-slate-400">
              Klik tombol di atas untuk masuk langsung & mencoba seluruh modul HR VALORA TV tanpa sandi.
            </p>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-slate-400 dark:text-slate-500">
          &copy; 2026 People Intelligence &middot; Enterprise HR Platform
        </p>
      </div>
    </div>
  );
}
