import { NextResponse } from "next/server";
import { getEditors, createEditor, updateEditor, deleteEditor, resetEditorPassword } from "@/lib/data";
import { requireAdmin, errorStatus } from "@/lib/auth";

export async function GET() {
  try {
    await requireAdmin();
    const editors = await getEditors();
    return NextResponse.json(editors);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to fetch editors" }, { status: errorStatus(error) });
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const { name, email, role, password } = await request.json();
    if (!password || password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });
    }
    const editor = await createEditor({ name, email, role, password });
    return NextResponse.json(editor, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to create editor" }, { status: errorStatus(error) });
  }
}

export async function PUT(request: Request) {
  try {
    await requireAdmin();
    const { id, ...input } = await request.json();
    // Handle password reset
    if (input.password) {
      if (input.password.length < 6) {
        return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });
      }
      const editor = await resetEditorPassword(id, input.password);
      return NextResponse.json(editor);
    }
    const editor = await updateEditor(id, input);
    return NextResponse.json(editor);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to update editor" }, { status: errorStatus(error) });
  }
}

export async function DELETE(request: Request) {
  try {
    await requireAdmin();
    const { id } = await request.json();
    await deleteEditor(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to delete editor" }, { status: errorStatus(error) });
  }
}
