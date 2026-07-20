import { NextResponse } from "next/server";
import { getRssSources, createRssSource, deleteRssSource, updateRssSource } from "@/lib/data";
import { requireAdmin, errorStatus } from "@/lib/auth";

export async function GET() {
  try {
    await requireAdmin();
    const sources = await getRssSources();
    return NextResponse.json(sources);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to fetch RSS sources" }, { status: errorStatus(error) });
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const body = await request.json();
    const source = await createRssSource(body);
    return NextResponse.json(source, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to create RSS source" }, { status: errorStatus(error) });
  }
}

export async function PUT(request: Request) {
  try {
    await requireAdmin();
    const { id, ...input } = await request.json();
    const source = await updateRssSource(id, input);
    return NextResponse.json(source);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to update RSS source" }, { status: errorStatus(error) });
  }
}

export async function DELETE(request: Request) {
  try {
    await requireAdmin();
    const { id } = await request.json();
    await deleteRssSource(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to delete RSS source" }, { status: errorStatus(error) });
  }
}
