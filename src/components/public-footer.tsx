"use client";

import Link from "next/link";
import { useState } from "react";
import { CheckCircle2, Loader2, ArrowRight } from "lucide-react";

type Category = { id: string; name: string; slug: string };
type MenuItem = { label: string; href: string; order: number; visible: boolean };
type Settings = Record<string, unknown> | null;

function SubscriberForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function subscribe(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus("loading");
    try {
      const res = await fetch("/api/subscribers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, sourcePath: "/" }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatus("success");
        setMessage("You are now subscribed. Thank you!");
        setEmail("");
      } else {
        setStatus("error");
        setMessage(data.error || "Subscription failed.");
      }
    } catch {
      setStatus("error");
      setMessage("Something went wrong. Please try again.");
    }
  }

  return (
    <div className="footer-subscribe">
      <h3 className="footer-subscribe-title">Stay informed</h3>
      <form onSubmit={subscribe} className="footer-subscribe-form">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Enter your email"
          required
          aria-label="Email address"
        />
        <button type="submit" disabled={status === "loading"} aria-label="Subscribe">
          {status === "loading" ? <Loader2 size={18} className="spinning" /> : <ArrowRight size={18} />}
        </button>
      </form>
      {status === "success" && (
        <p className="footer-subscribe-message success"><CheckCircle2 size={14} /> {message}</p>
      )}
      {status === "error" && (
        <p className="footer-subscribe-message error">{message}</p>
      )}
      <p className="footer-subscribe-note">By subscribing, you agree to our <Link href="/privacy">Privacy Policy</Link>.</p>
    </div>
  );
}

export function PublicFooter({
  settings,
  categories,
  menuItems,
}: {
  settings: Settings;
  categories: Category[];
  menuItems: MenuItem[];
}) {
  const publicationName = (settings?.publicationName as string) || "Behind The Headlines";
  const tagline = (settings?.tagline as string) || "Independent reporting, analysis, and stories that matter.";
  const logoUrl = (settings?.logoUrl as string) || "";
  const footerTextColor = (settings?.footerTextColor as string) || "#ffffff";

  return (
    <footer className="public-footer" style={{ color: footerTextColor }}>
      <div className="footer-inner">
        <div className="footer-columns">
          <div className="footer-col footer-brand-col">
            <Link href="/" className="footer-logo-link">
              {logoUrl ? (
                <img src={logoUrl} alt={publicationName} className="footer-logo" />
              ) : (
                <span className="footer-logo-text">{publicationName}</span>
              )}
            </Link>
            <p className="footer-brand-description">{tagline}</p>
            <SubscriberForm />
          </div>

          {categories.length > 0 && (
            <div className="footer-col">
              <h4>Categories</h4>
              <ul>
                {categories.slice(0, 8).map((cat) => (
                  <li key={cat.id}>
                    <Link href={`/category/${cat.slug}`}>{cat.name}</Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {menuItems.length > 0 && (
            <div className="footer-col">
              <h4>Quick Links</h4>
              <ul>
                {menuItems.filter((item) => item.visible).sort((a, b) => a.order - b.order).slice(0, 8).map((item, i) => (
                  <li key={i}>
                    <Link href={item.href}>{item.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      <div className="footer-bottom">
        <div className="footer-bottom-inner">
          <span>&copy; {new Date().getFullYear()} {publicationName}. All rights reserved.</span>
          <div className="footer-bottom-links">
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
            <Link href="/copyright">Copyright</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
