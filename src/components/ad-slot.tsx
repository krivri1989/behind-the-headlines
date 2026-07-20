import { headers } from "next/headers";
import { resolveAdForSlot, replaceCacheBusting, detectDevice, type PublicAd } from "@/lib/public-data";
import { VideoAd } from "./video-ad";

/**
 * Server component that resolves and renders an ad for a given slot.
 * Shows "Advertisement" label above the creative (except for 1x1 trackers).
 * Detects device (desktop/mobile) from the request User-Agent and only shows
 * ads whose `device` field matches ("all" matches any device).
 *
 * Props:
 *   slot        — slot name (e.g., "homepage_tri_col_top")
 *   categorySlug — optional, for category-specific targeting
 *   page        — optional, "homepage" | "category" | "article"
 */
export async function AdSlot({
  slot,
  categorySlug,
  page,
}: {
  slot: string;
  categorySlug?: string;
  page?: string;
}) {
  const headerList = await headers();
  const userAgent = headerList.get("user-agent");
  const device = detectDevice(userAgent);
  const ad = await resolveAdForSlot(slot, { page, categorySlug, device });
  if (!ad) return null;

  // 1x1 trackers are invisible — just fire the pixel, no label
  if (ad.type === "tracker" || ad.size === "1x1") {
    return <AdTracker ad={ad} />;
  }

  return (
    <div className={`ad-slot ad-slot-${ad.size}`} data-slot={slot}>
      <span className="ad-slot-label">Advertisement</span>
      <div className="ad-slot-creative">
        <AdCreative ad={ad} />
      </div>
      {ad.impressionPixelUrl && <AdImpressionPixel url={ad.impressionPixelUrl} />}
    </div>
  );
}

/** Renders the ad creative based on its type. */
function AdCreative({ ad }: { ad: PublicAd }) {
  switch (ad.type) {
    case "direct":
      return <DirectAd ad={ad} />;

    case "third_party":
      return <ThirdPartyAd ad={ad} />;

    case "youtube":
      return <VideoAd youtubeId={ad.youtubeId} />;

    case "vast":
      return <VastAd ad={ad} />;

    default:
      return null;
  }
}

/** Direct creative: image, GIF, or MP4. */
function DirectAd({ ad }: { ad: PublicAd }) {
  const isVideo = ad.mediaUrl.endsWith(".mp4") || ad.mediaUrl.includes("video/mp4");
  const clickHref = ad.clickTrackingUrl
    ? `/api/ads/track?adId=${ad.id}&type=click&clickTrackingUrl=${encodeURIComponent(ad.clickTrackingUrl)}&redirect=${encodeURIComponent(ad.clickUrl)}`
    : ad.clickUrl;

  if (isVideo) {
    return (
      <a href={clickHref || "#"} target="_blank" rel="noopener noreferrer sponsored">
        <video src={ad.mediaUrl} autoPlay muted loop playsInline width="100%" height="auto" />
      </a>
    );
  }

  return (
    <a href={clickHref || "#"} target="_blank" rel="noopener noreferrer sponsored">
      <img src={ad.mediaUrl} alt={ad.name} width="100%" height="auto" style={{ display: "block" }} />
    </a>
  );
}

/** Third-party tag: raw JS/HTML rendered in a sandboxed iframe. */
function ThirdPartyAd({ ad }: { ad: PublicAd }) {
  const tag = replaceCacheBusting(ad.rawTag);
  return (
    <iframe
      srcDoc={tag}
      sandbox="allow-scripts"
      className="ad-slot-iframe"
      scrolling="no"
      frameBorder={0}
      title={ad.name}
    />
  );
}

/** VAST-lite video: fetches media URL client-side via /api/ads/vast. */
function VastAd({ ad }: { ad: PublicAd }) {
  return <VideoAd vastUrl={ad.vastUrl} />;
}

/** Hidden 1x1 impression pixel. */
function AdImpressionPixel({ url }: { url: string }) {
  const trackedUrl = replaceCacheBusting(url);
  return (
    <img
      src={trackedUrl}
      width={1}
      height={1}
      alt=""
      style={{ display: "none", border: 0 }}
      loading="lazy"
    />
  );
}

/** Tracker-only ad (1x1, no visible creative). */
function AdTracker({ ad }: { ad: PublicAd }) {
  const pixelUrl = ad.impressionPixelUrl || ad.mediaUrl;
  if (!pixelUrl) return null;
  const trackedUrl = replaceCacheBusting(pixelUrl);
  return (
    <img
      src={trackedUrl}
      width={1}
      height={1}
      alt=""
      style={{ display: "none", border: 0 }}
      loading="lazy"
    />
  );
}
