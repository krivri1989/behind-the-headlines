import { NextResponse } from "next/server";
import { getRssImports } from "@/lib/data";
import { requireAdmin, errorStatus } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(request.url);
    const sourceId = searchParams.get("sourceId") || undefined;
    const search = searchParams.get("search") || undefined;
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const imports = await getRssImports({ sourceId, search, limit });
    return NextResponse.json(imports);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to fetch RSS imports" }, { status: errorStatus(error) });
  }
}
