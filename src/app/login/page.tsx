"use client";

import { ArrowRight, Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api-client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      await apiFetch("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      router.push("/dashboard");
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Login failed.");
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="login-brand">
          <span>BH</span>
          <p>Behind<br /><strong>The Headlines</strong></p>
        </div>
        <p className="eyebrow">NEWSROOM ACCESS</p>
        <h1>Sign in to your workspace</h1>
        <p className="subtitle">Enter your credentials to access the editorial dashboard.</p>
        <form className="login-form" onSubmit={submit}>
          <label>
            Email address
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@behindtheheadlines.com" required autoComplete="email" />
          </label>
          <label>
            Password
            <div className="password-field">
              <input type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Your password" required autoComplete="current-password" />
              <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Hide password" : "Show password"}>
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </label>
          {error && <p className="login-error">{error}</p>}
          <button className="primary-button login-submit" type="submit" disabled={loading}>
            {loading ? <Loader2 size={18} className="spinning" /> : <ShieldCheck size={18} />}
            {loading ? "Signing in…" : "Sign in"}
            {!loading && <ArrowRight size={16} />}
          </button>
        </form>
      </section>
    </main>
  );
}
