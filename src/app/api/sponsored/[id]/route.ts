import { NextResponse } from "next/server";
import { updateSponsoredContent, deleteSponsoredContent } from "@/lib/data";
import { requireAdmin, errorStatus } from "@/lib/auth";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const body = await request.json();
    const item = await updateSponsoredContent(id, body);
    if (!item) return NextResponse.json({ error: "Sponsored content not found" }, { status: 404 });
    return NextResponse.json(item);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to update sponsored content" }, { status: errorStatus(error) });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    await deleteSponsoredContent(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to delete sponsored content" }, { status: errorStatus(error) });
  }
}
