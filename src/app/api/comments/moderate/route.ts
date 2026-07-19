import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { Comment, Article } from "@/lib/models";
import { requireAdmin } from "@/lib/auth";

// GET /api/comments/moderate?status=pending — list comments for moderation
export async function GET(request: Request) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "pending";

    await connectToDatabase();

    const query: Record<string, unknown> = {};
    if (status !== "all") query.status = status;

    const comments = await Comment.find(query)
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

    // Fetch article titles for each comment
    const articleIds = [...new Set(comments.map((c) => (c as Record<string, unknown>).articleId))];
    const articles = await Article.find({ _id: { $in: articleIds } }).lean();
    const articleMap = new Map(articles.map((a) => [String((a as Record<string, unknown>)._id), (a as Record<string, unknown>).title as string]));

    return NextResponse.json({
      comments: comments.map((c) => ({
        id: String((c as Record<string, unknown>)._id),
        articleId: String((c as Record<string, unknown>).articleId),
        articleTitle: articleMap.get(String((c as Record<string, unknown>).articleId)) || "Unknown article",
        authorName: (c as Record<string, unknown>).authorName as string,
        authorEmail: (c as Record<string, unknown>).authorEmail as string,
        content: (c as Record<string, unknown>).content as string,
        status: (c as Record<string, unknown>).status as string,
        createdAt: (c as Record<string, unknown>).createdAt as string,
      })),
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to fetch comments" }, { status: 500 });
  }
}

// PUT /api/comments/moderate — approve, reject, or delete a comment
export async function PUT(request: Request) {
  try {
    await requireAdmin();
    const { id, action } = await request.json();
    if (!id || !action) return NextResponse.json({ error: "id and action are required" }, { status: 400 });

    await connectToDatabase();

    if (action === "delete") {
      await Comment.findByIdAndDelete(id);
      return NextResponse.json({ success: true, action: "deleted" });
    }

    if (action === "approve") {
      await Comment.findByIdAndUpdate(id, { status: "approved" });
      return NextResponse.json({ success: true, action: "approved" });
    }

    if (action === "reject") {
      await Comment.findByIdAndUpdate(id, { status: "rejected" });
      return NextResponse.json({ success: true, action: "rejected" });
    }

    return NextResponse.json({ error: "Invalid action. Use approve, reject, or delete." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to moderate comment" }, { status: 500 });
  }
}
