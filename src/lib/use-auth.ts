"use client";

/* ═══════════════════════════════════════════════════════════════════════════
   useAuthGate — client-side auth gate for the AppShell.
   - If Supabase isn't configured, returns "authed" immediately (no gate;
     the app runs in localStorage-only fallback mode).
   - Otherwise checks the Supabase session: "authed" when logged in,
     "anon" → redirects to /login. Listens for login/logout in real time.
═══════════════════════════════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { supabase, isSupabaseConfigured } from "./supabase";

export type AuthStatus = "loading" | "authed" | "anon";

export function useAuthGate() {
  const router = useRouter();
  const [status, setStatus] = useState<AuthStatus>(() => {
    if (typeof window !== "undefined" && localStorage.getItem("demo_bypass") === "true") {
      return "authed";
    }
    return isSupabaseConfigured ? "loading" : "authed";
  });
  const [email, setEmail] = useState(() => {
    if (typeof window !== "undefined" && localStorage.getItem("demo_bypass") === "true") {
      return "demo@localhost";
    }
    return "";
  });

  useEffect(() => {
    if (typeof window !== "undefined" && localStorage.getItem("demo_bypass") === "true") {
      setStatus("authed");
      setEmail("demo@localhost");
      return;
    }
    if (!isSupabaseConfigured || !supabase) return; // no auth configured → no gate
    let active = true;

    const apply = (session: Session | null) => {
      if (!active) return;
      if (typeof window !== "undefined" && localStorage.getItem("demo_bypass") === "true") {
        setEmail("demo@localhost");
        setStatus("authed");
        return;
      }
      if (session) {
        setEmail(session.user.email ?? "");
        setStatus("authed");
      } else {
        setStatus("anon");
        router.replace("/login");
      }
    };

    supabase.auth.getSession().then(({ data }) => apply(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => apply(session));

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [router]);

  return { status, email };
}

export async function signOut(): Promise<void> {
  if (typeof window !== "undefined") {
    localStorage.removeItem("demo_bypass");
  }
  if (!supabase) return;
  await supabase.auth.signOut();
}
