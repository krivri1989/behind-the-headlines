"use client";

import { useEffect, useState } from "react";
import type { PublicAd } from "@/lib/public-data";

/** Client-side cache-busting macro replacement (mirrors the server-side version). */
function replaceCacheBusting(input: string): string {
  const random = Date.now() + Math.floor(Math.random() * 1_000_000);
  return input
    .replaceAll("[timestamp]", String(random))
    .replaceAll("[CACHEBUSTER]", String(random))
    .replaceAll("ord=[timestamp]", "ord=" + random);
}

/**
 * Client component for the interstitial ad overlay.
 * Shows once per browser session (sessionStorage flag).
 * Detects mobile vs desktop to pick the right size.
 * Not shown to crawlers (UA check).
 *
 * Props:
 *   webAd    — the resolved interstitial ad for desktop, or null
 *   mobileAd — the resolved interstitial ad for mobile, or null
 */
export function InterstitialAd({ webAd, mobileAd }: { webAd: PublicAd | null; mobileAd: PublicAd | null }) {
  const [show, setShow] = useState(false);
  const [selectedAd, setSelectedAd] = useState<PublicAd | null>(null);

  useEffect(() => {
    // Pick the right ad based on screen width
    const isMobile = window.innerWidth < 768;
    const ad = isMobile ? mobileAd : webAd;
    setSelectedAd(ad);
    if (!ad) return;

    // Don't show to crawlers
    const ua = navigator.userAgent.toLowerCase();
    if (/bot|crawl|spider|slurp|googlebot|bingbot|yandex/i.test(ua)) return;

    // Only show once per session
    const seen = sessionStorage.getItem("bth_interstitial_seen");
    if (seen) return;

    // Small delay so the page loads first
    const timer = setTimeout(() => {
      setShow(true);
      sessionStorage.setItem("bth_interstitial_seen", "1");
    }, 1500);

    return () => clearTimeout(timer);
  }, [webAd, mobileAd]);

  if (!selectedAd || !show) return null;

  const ad = selectedAd;
  const isMobile = ad.size === "320x480";

  function close() {
    setShow(false);
  }

  // Close on Escape key
  useEffect(() => {
    if (!show) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [show]);

  return (
    <div className="ad-interstitial-overlay" onClick={close} role="dialog" aria-modal="true" aria-label="Advertisement">
      <div
        className={`ad-interstitial-content ${isMobile ? "ad-interstitial-mobile" : "ad-interstitial-web"}`}
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="ad-interstitial-close" onClick={close} aria-label="Close advertisement">
          ✕
        </button>
        <span className="ad-slot-label">Advertisement</span>
        <div className="ad-interstitial-creative">
          <InterstitialCreative ad={ad} />
        </div>
      </div>
    </div>
  );
}

/** Renders the interstitial creative based on its type. */
function InterstitialCreative({ ad }: { ad: PublicAd }) {
  const isVideo = ad.type === "direct" && (ad.mediaUrl.endsWith(".mp4") || ad.mediaUrl.includes("video/mp4"));

  if (ad.type === "youtube") {
    return (
      <iframe
        src={`https://www.youtube.com/embed/${ad.youtubeId}?autoplay=1&mute=1&controls=0&rel=0&modestbranding=1&playsinline=1`}
        title="Advertisement"
        allow="autoplay; encrypted-media"
        frameBorder={0}
        style={{ width: "100%", height: "100%" }}
      />
    );
  }

  if (ad.type === "third_party") {
    const tag = replaceCacheBusting(ad.rawTag);
    return (
      <iframe
        srcDoc={tag}
        sandbox="allow-scripts"
        className="ad-slot-iframe"
        scrolling="no"
        frameBorder={0}
        title="Advertisement"
        style={{ width: "100%", height: "100%" }}
      />
    );
  }

  if (isVideo) {
    return <video src={ad.mediaUrl} autoPlay muted loop playsInline style={{ width: "100%", height: "100%", objectFit: "cover" }} />;
  }

  // Default: image
  const clickHref = ad.clickTrackingUrl
    ? `/api/ads/track?adId=${ad.id}&type=click&clickTrackingUrl=${encodeURIComponent(ad.clickTrackingUrl)}&redirect=${encodeURIComponent(ad.clickUrl)}`
    : ad.clickUrl;

  return (
    <a href={clickHref || "#"} target="_blank" rel="noopener noreferrer sponsored" style={{ display: "block", width: "100%", height: "100%" }}>
      <img src={ad.mediaUrl} alt={ad.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
    </a>
  );
}
