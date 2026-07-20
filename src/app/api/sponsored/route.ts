import { NextResponse } from "next/server";
import { getSponsoredContent, createSponsoredContent } from "@/lib/data";
import { requireAdmin, errorStatus } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(request.url);
    const categorySlug = searchParams.get("categorySlug") || undefined;
    const active = searchParams.get("active");
    const filters = {
      categorySlug: categorySlug || undefined,
      active: active === "true" ? true : active === "false" ? false : undefined,
    };
    const items = await getSponsoredContent(filters);
    return NextResponse.json({ sponsored: items });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to fetch sponsored content" }, { status: errorStatus(error) });
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const body = await request.json();
    if (!body.type || !body.categorySlug) {
      return NextResponse.json({ error: "type and categorySlug are required" }, { status: 400 });
    }
    const item = await createSponsoredContent(body);
    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to create sponsored content" }, { status: errorStatus(error) });
  }
}
