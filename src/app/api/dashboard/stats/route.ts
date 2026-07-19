import { NextResponse } from "next/server";
import { getDashboardStats } from "@/lib/data";
import { getSession } from "@/lib/auth";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    const authorId = session.role === "editor" ? session.id : undefined;
    const stats = await getDashboardStats({ authorId });
    return NextResponse.json(stats);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to fetch dashboard stats" }, { status: 500 });
  }
}
