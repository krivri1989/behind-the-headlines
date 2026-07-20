import { NextResponse } from "next/server";
import { getMenus, updateMenuItems } from "@/lib/data";
import { requireAdmin, errorStatus } from "@/lib/auth";

export async function GET() {
  try {
    await requireAdmin();
    const menus = await getMenus();
    return NextResponse.json(menus);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to fetch menus" }, { status: errorStatus(error) });
  }
}

export async function PUT(request: Request) {
  try {
    await requireAdmin();
    const { location, items } = await request.json();
    const menu = await updateMenuItems(location, items);
    return NextResponse.json(menu);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to update menu" }, { status: errorStatus(error) });
  }
}
