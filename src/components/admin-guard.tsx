"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api-client";

type SessionUser = { id: string; email: string; name: string; role: "admin" | "editor" };

/**
 * Client-side guard for admin-only dashboard pages.
 *
 * Fetches the current session and, if the user is not an admin (or not logged
 * in), redirects to /dashboard. While the session is being checked, a loading
 * state is rendered to avoid flashing the protected page content.
 *
 * Usage: wrap the page's returned JSX with <AdminGuard>{...}</AdminGuard>
 */
export function AdminGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<"loading" | "ok" | "redirecting">("loading");

  useEffect(() => {
    let cancelled = false;
    apiFetch<{ user: SessionUser | null }>("/api/auth/session")
      .then(({ user }) => {
        if (cancelled) return;
        if (!user) {
          setState("redirecting");
          router.replace("/login");
        } else if (user.role !== "admin") {
          setState("redirecting");
          router.replace("/dashboard");
        } else {
          setState("ok");
        }
      })
      .catch(() => {
        if (cancelled) return;
        setState("redirecting");
        router.replace("/login");
      });
    return () => { cancelled = true; };
  }, [router]);

  if (state !== "ok") {
    return (
      <main className="app-shell">
        <div className="dashboard-content">
          <p className="empty-state">{state === "redirecting" ? "Redirecting…" : "Loading…"}</p>
        </div>
      </main>
    );
  }
  return <>{children}</>;
}
