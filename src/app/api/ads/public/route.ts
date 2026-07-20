import { NextResponse } from "next/server";
import { resolveAdsForSlots, resolveAdForSlot, getInterstitialAd } from "@/lib/public-data";

/**
 * Public ad resolution endpoint.
 * GET /api/ads/public?slots=homepage_tri_col_top,homepage_sidebar_top&page=homepage&categorySlug=national
 * GET /api/ads/public?slot=homepage_tri_col_top&page=homepage
 * GET /api/ads/public?interstitial=web
 * GET /api/ads/public?interstitial=mobile
 *
 * Returns: { ads: { [slot]: PublicAd | null } } or { ad: PublicAd | null } or { interstitial: PublicAd | null }
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const context = {
      page: searchParams.get("page") || undefined,
      categorySlug: searchParams.get("categorySlug") || undefined,
    };

    // Interstitial request
    const interstitial = searchParams.get("interstitial");
    if (interstitial === "web" || interstitial === "mobile") {
      const ad = await getInterstitialAd(interstitial === "mobile");
      return NextResponse.json({ interstitial: ad });
    }

    // Single slot request
    const singleSlot = searchParams.get("slot");
    if (singleSlot) {
      const ad = await resolveAdForSlot(singleSlot, context);
      return NextResponse.json({ ad });
    }

    // Multi-slot request
    const slotsParam = searchParams.get("slots");
    if (slotsParam) {
      const slots = slotsParam.split(",").map((s) => s.trim()).filter(Boolean);
      const ads = await resolveAdsForSlots(slots, context);
      return NextResponse.json({ ads });
    }

    return NextResponse.json({ error: "Provide 'slot', 'slots', or 'interstitial' parameter" }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to fetch ads" }, { status: 500 });
  }
}
