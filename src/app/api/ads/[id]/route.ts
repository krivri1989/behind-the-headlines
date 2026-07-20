import { NextResponse } from "next/server";
import { updateAd, deleteAd } from "@/lib/data";
import { requireAdmin, errorStatus } from "@/lib/auth";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const body = await request.json();
    const ad = await updateAd(id, body);
    if (!ad) return NextResponse.json({ error: "Ad not found" }, { status: 404 });
    return NextResponse.json(ad);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to update ad" }, { status: errorStatus(error) });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    await deleteAd(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to delete ad" }, { status: errorStatus(error) });
  }
}
