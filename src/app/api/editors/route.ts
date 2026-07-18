import { NextResponse } from "next/server";
import { getEditors, createEditor, updateEditor, deleteEditor } from "@/lib/data";
import { requireAdmin } from "@/lib/auth";

export async function GET() {
  try {
    await requireAdmin();
    const editors = await getEditors();
    return NextResponse.json(editors);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to fetch editors" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const { name, email, role } = await request.json();
    const editor = await createEditor({ name, email, role });
    return NextResponse.json(editor, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to create editor" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    await requireAdmin();
    const { id, ...input } = await request.json();
    const editor = await updateEditor(id, input);
    return NextResponse.json(editor);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to update editor" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    await requireAdmin();
    const { id } = await request.json();
    await deleteEditor(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to delete editor" }, { status: 500 });
  }
}
