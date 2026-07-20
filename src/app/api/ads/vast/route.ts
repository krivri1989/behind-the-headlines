import { NextResponse } from "next/server";
import { resolveVastMediaUrl } from "@/lib/public-data";

/**
 * Public VAST-lite endpoint.
 * GET /api/ads/vast?url=<vast_url>
 *
 * Fetches the VAST XML server-side, extracts the first <MediaFile> URL,
 * and returns it. This avoids CORS issues with client-side VAST fetching.
 *
 * Returns: { mediaUrl: string | null }
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const vastUrl = searchParams.get("url");
    if (!vastUrl) {
      return NextResponse.json({ error: "url parameter is required" }, { status: 400 });
    }

    // Basic validation — must be HTTPS
    try {
      const parsed = new URL(vastUrl);
      if (parsed.protocol !== "https:") {
        return NextResponse.json({ error: "VAST URL must use HTTPS" }, { status: 400 });
      }
    } catch {
      return NextResponse.json({ error: "Invalid VAST URL" }, { status: 400 });
    }

    const mediaUrl = await resolveVastMediaUrl(vastUrl);
    return NextResponse.json({ mediaUrl });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to fetch VAST" }, { status: 500 });
  }
}
