import { NextResponse } from "next/server";
import { getCategories, createCategory, updateCategory, deleteCategory } from "@/lib/data";
import { requireAdmin, errorStatus } from "@/lib/auth";

export async function GET() {
  try {
    await requireAdmin();
    const categories = await getCategories();
    return NextResponse.json(categories);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to fetch categories" }, { status: errorStatus(error) });
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const body = await request.json();
    const category = await createCategory(body);
    return NextResponse.json(category, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to create category" }, { status: errorStatus(error) });
  }
}

export async function PUT(request: Request) {
  try {
    await requireAdmin();
    const { id, ...input } = await request.json();
    const category = await updateCategory(id, input);
    return NextResponse.json(category);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to update category" }, { status: errorStatus(error) });
  }
}

export async function DELETE(request: Request) {
  try {
    await requireAdmin();
    const { id } = await request.json();
    await deleteCategory(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to delete category" }, { status: errorStatus(error) });
  }
}
