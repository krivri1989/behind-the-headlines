import { NextResponse } from "next/server";
import { getSiteSettings, updateSiteSettings } from "@/lib/data";
import { requireAdmin } from "@/lib/auth";

export async function GET() {
  try {
    const settings = await getSiteSettings();
    return NextResponse.json(settings);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to fetch settings" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    await requireAdmin();
    const body = await request.json();
    const settings = await updateSiteSettings(body);
    return NextResponse.json(settings);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to update settings" }, { status: 500 });
  }
}
