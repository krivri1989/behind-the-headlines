import { NextResponse } from "next/server";
import { getAuditLogs } from "@/lib/data";
import { requireAdmin, errorStatus } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || undefined;
    const category = searchParams.get("category") || undefined;
    const logs = await getAuditLogs({ search, category });
    return NextResponse.json(logs);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to fetch audit logs" }, { status: errorStatus(error) });
  }
}
