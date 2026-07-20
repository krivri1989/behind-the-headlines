import { NextResponse } from "next/server";
import { getSponsoredForCategory } from "@/lib/public-data";

/**
 * Public sponsored content endpoint.
 * GET /api/sponsored/public?categorySlug=national
 *
 * Returns active sponsored content pinned to the given category.
 * Returns: { sponsored: PublicSponsored[] }
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const categorySlug = searchParams.get("categorySlug");
    if (!categorySlug) {
      return NextResponse.json({ error: "categorySlug parameter is required" }, { status: 400 });
    }
    const sponsored = await getSponsoredForCategory(categorySlug);
    return NextResponse.json({ sponsored });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to fetch sponsored content" }, { status: 500 });
  }
}
