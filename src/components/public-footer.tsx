"use client";

import Link from "next/link";
import { useState } from "react";
import { Mail, CheckCircle2, Loader2 } from "lucide-react";

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
    <div className="subscriber-form-wrapper">
      <div>
        <h3>Subscribe to our newsletter</h3>
        <p>Get the latest stories delivered to your inbox.</p>
      </div>
      <form onSubmit={subscribe} className="subscriber-form">
        <div className="subscriber-input-row">
          <Mail size={18} className="subscriber-mail-icon" />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email address"
            required
            aria-label="Email address"
          />
          <button type="submit" disabled={status === "loading"}>
            {status === "loading" ? <Loader2 size={16} className="spinning" /> : "Subscribe"}
          </button>
        </div>
        {status === "success" && (
          <p className="subscriber-success"><CheckCircle2 size={15} /> {message}</p>
        )}
        {status === "error" && (
          <p className="subscriber-error">{message}</p>
        )}
        <label className="subscriber-consent">
          <input type="checkbox" required /> I agree to receive newsletters and accept the <Link href="/privacy">privacy policy</Link>.
        </label>
      </form>
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
  const tagline = (settings?.tagline as string) || "";
  const contactEmail = (settings?.contactEmail as string) || "";

  return (
    <footer className="public-footer">
      <div className="footer-inner">
        {/* Subscriber section */}
        <div className="footer-subscriber">
          <SubscriberForm />
        </div>

        {/* Footer columns */}
        <div className="footer-columns">
          <div className="footer-col footer-col-wide">
            <h4>{publicationName}</h4>
            <p>{tagline || "Independent reporting, analysis, and stories that matter."}</p>
            {contactEmail && <p className="footer-contact"><Mail size={14} /> {contactEmail}</p>}
          </div>

          {menuItems.length > 0 && (
            <div className="footer-col">
              <h4>Quick Links</h4>
              <ul>
                {menuItems.filter((item) => item.visible).sort((a, b) => a.order - b.order).map((item, i) => (
                  <li key={i}><Link href={item.href}>{item.label}</Link></li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Bottom bar */}
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
