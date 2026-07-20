import { NextResponse } from "next/server";
import { getAds, createAd } from "@/lib/data";
import { requireAdmin, errorStatus } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(request.url);
    const slot = searchParams.get("slot") || undefined;
    const scope = searchParams.get("scope") || undefined;
    const active = searchParams.get("active");
    const filters = {
      slot: slot || undefined,
      scope: scope || undefined,
      active: active === "true" ? true : active === "false" ? false : undefined,
    };
    const ads = await getAds(filters);
    return NextResponse.json({ ads });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to fetch ads" }, { status: errorStatus(error) });
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const body = await request.json();
    if (!body.name || !body.slot || !body.size || !body.type) {
      return NextResponse.json({ error: "name, slot, size, and type are required" }, { status: 400 });
    }
    const ad = await createAd(body);
    return NextResponse.json(ad, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to create ad" }, { status: errorStatus(error) });
  }
}
