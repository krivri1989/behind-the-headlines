import { NextResponse } from "next/server";
import { incrementAdImpression, incrementAdClick } from "@/lib/data";
import { replaceCacheBusting } from "@/lib/public-data";

/**
 * Public ad tracking endpoint.
 *
 * POST /api/ads/track
 *   Body: { adId: string, type: "impression" | "click", clickTrackingUrl?: string }
 *   Increments internal counters and fires third-party click tracking URL.
 *
 * GET /api/ads/track?adId=...&type=click&clickTrackingUrl=...&redirect=...
 *   Same as POST but returns a redirect to the `redirect` URL (for click tracking).
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const adId = searchParams.get("adId");
    const type = searchParams.get("type");
    const clickTrackingUrl = searchParams.get("clickTrackingUrl") || undefined;
    const redirect = searchParams.get("redirect") || undefined;

    if (!adId || !type) {
      return NextResponse.json({ error: "adId and type are required" }, { status: 400 });
    }

    if (type === "impression") {
      incrementAdImpression(adId).catch(() => {});
    } else if (type === "click") {
      incrementAdClick(adId).catch(() => {});
      if (clickTrackingUrl) {
        const trackedUrl = replaceCacheBusting(clickTrackingUrl);
        fetch(trackedUrl, { method: "GET", headers: { "User-Agent": "BehindTheHeadlines/1.0" } }).catch(() => {});
      }
    }

    if (redirect) {
      return NextResponse.redirect(redirect, { status: 302 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to track ad" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { adId, type, clickTrackingUrl } = body as { adId?: string; type?: string; clickTrackingUrl?: string };

    if (!adId || !type) {
      return NextResponse.json({ error: "adId and type are required" }, { status: 400 });
    }

    // Increment internal counter (best-effort, non-blocking)
    if (type === "impression") {
      incrementAdImpression(adId).catch(() => {});
    } else if (type === "click") {
      incrementAdClick(adId).catch(() => {});

      // Fire third-party click tracking URL server-side (best-effort)
      if (clickTrackingUrl) {
        const trackedUrl = replaceCacheBusting(clickTrackingUrl);
        fetch(trackedUrl, { method: "GET", headers: { "User-Agent": "BehindTheHeadlines/1.0" } }).catch(() => {});
      }
    } else {
      return NextResponse.json({ error: "type must be 'impression' or 'click'" }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to track ad" }, { status: 500 });
  }
}
