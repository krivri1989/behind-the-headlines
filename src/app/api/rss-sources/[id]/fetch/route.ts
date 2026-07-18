import { NextResponse } from "next/server";
import { importRssSource } from "@/lib/rss-import";
import { requireAdmin } from "@/lib/auth";
import { rateLimit } from "@/lib/redis";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdmin();
    const { id } = await params;

    // Rate limit: 6 fetches per minute per source
    const { allowed } = await rateLimit(`rss-fetch:${id}`, 6, 60);
    if (!allowed) {
      return NextResponse.json(
        { error: "This source was fetched recently. Please wait a moment." },
        { status: 429, headers: { "Retry-After": "60" } },
      );
    }

    const result = await importRssSource(id, session.id);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch RSS source" },
      { status: error instanceof Error && error.message.includes("required") ? 401 : 500 },
    );
  }
}
