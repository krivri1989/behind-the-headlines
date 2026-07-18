import { NextResponse } from "next/server";
import { importAllActiveSources } from "@/lib/rss-import";
import { requireAdmin } from "@/lib/auth";
import { rateLimit } from "@/lib/redis";

export async function POST(request: Request) {
  try {
    const session = await requireAdmin();

    // Rate limit: 2 fetch-all operations per minute
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const { allowed } = await rateLimit(`rss-fetch-all:${ip}`, 2, 60);
    if (!allowed) {
      return NextResponse.json(
        { error: "Fetch All was triggered recently. Please wait a minute." },
        { status: 429, headers: { "Retry-After": "60" } },
      );
    }

    const results = await importAllActiveSources(session.id);
    const totalImported = results.reduce((sum, r) => sum + r.importedCount, 0);
    const totalSkipped = results.reduce((sum, r) => sum + r.skippedCount, 0);
    const failed = results.filter((r) => r.status === "failed");

    return NextResponse.json({
      results,
      summary: {
        totalSources: results.length,
        totalImported,
        totalSkipped,
        failedCount: failed.length,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch RSS sources" },
      { status: error instanceof Error && error.message.includes("required") ? 401 : 500 },
    );
  }
}
