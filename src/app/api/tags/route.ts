import { NextResponse } from "next/server";
import { getTags, createTag, deleteTag } from "@/lib/data";
import { requireAdmin, errorStatus } from "@/lib/auth";

export async function GET() {
  try {
    await requireAdmin();
    const tags = await getTags();
    return NextResponse.json(tags);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to fetch tags" }, { status: errorStatus(error) });
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const { name } = await request.json();
    const tag = await createTag(name);
    return NextResponse.json(tag, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to create tag" }, { status: errorStatus(error) });
  }
}

export async function DELETE(request: Request) {
  try {
    await requireAdmin();
    const { id } = await request.json();
    await deleteTag(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to delete tag" }, { status: errorStatus(error) });
  }
}
