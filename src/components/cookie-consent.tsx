"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";

const STORAGE_KEY = "bth-cookie-consent";

export function CookieConsent({ enabled }: { enabled: boolean }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    try {
      const consent = localStorage.getItem(STORAGE_KEY);
      if (!consent) setVisible(true);
    } catch {
      // localStorage might be blocked; don't show banner
    }
  }, [enabled]);

  function dismiss() {
    try {
      localStorage.setItem(STORAGE_KEY, "accepted");
    } catch {
      // ignore storage errors
    }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="cookie-consent">
      <div className="cookie-consent-inner">
        <p className="cookie-consent-text">
          We use cookies to improve your browsing experience and analyze site traffic. By continuing to use our site, you agree to our use of cookies.{" "}
          <Link href="/privacy">Privacy Policy</Link>
        </p>
        <div className="cookie-consent-actions">
          <button type="button" className="cookie-consent-accept" onClick={dismiss}>Accept</button>
          <button type="button" className="cookie-consent-close" onClick={dismiss} aria-label="Dismiss"><X size={16} /></button>
        </div>
      </div>
    </div>
  );
}
