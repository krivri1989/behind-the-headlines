import { NextResponse } from "next/server";
import { getNextArticle } from "@/lib/public-data";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const categories = searchParams.get("categories");
    if (!id || !categories) {
      return NextResponse.json({ error: "Missing id or categories" }, { status: 400 });
    }
    const categoryIds = categories.split(",");
    const article = await getNextArticle(id, categoryIds);
    if (!article) return NextResponse.json({ article: null });
    return NextResponse.json({ article });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to fetch next article" }, { status: 500 });
  }
}
