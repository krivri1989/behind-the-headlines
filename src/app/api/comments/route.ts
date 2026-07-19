import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { Comment, Article, SiteSettings } from "@/lib/models";

// Strip all HTML tags and dangerous characters from user input
function sanitizeText(input: string): string {
  return input
    .replace(/<[^>]*>/g, "")        // strip HTML tags
    .replace(/&/g, "&amp;")         // escape ampersands
    .replace(/</g, "&lt;")          // escape less-than
    .replace(/>/g, "&gt;")          // escape greater-than
    .replace(/"/g, "&quot;")        // escape quotes
    .replace(/'/g, "&#x27;")        // escape single quotes
    .replace(/\u0000/g, "")         // remove null bytes
    .trim();
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// GET /api/comments?articleId=xxx
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const articleId = searchParams.get("articleId");
    if (!articleId) return NextResponse.json({ error: "articleId is required" }, { status: 400 });

    await connectToDatabase();

    // Only return comments if comments are enabled
    const settings = await SiteSettings.findOne().lean() as unknown as { enableComments?: boolean } | null;
    if (!settings?.enableComments) return NextResponse.json({ comments: [], enabled: false });

    const comments = await Comment.find({ articleId, status: "approved" })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    return NextResponse.json({
      enabled: true,
      comments: comments.map((c) => ({
        id: String((c as Record<string, unknown>)._id),
        authorName: (c as Record<string, unknown>).authorName as string,
        content: (c as Record<string, unknown>).content as string,
        createdAt: (c as Record<string, unknown>).createdAt as string,
      })),
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to fetch comments" }, { status: 500 });
  }
}

// POST /api/comments
export async function POST(request: Request) {
  try {
    const { articleId, authorName, authorEmail, content } = await request.json();
    if (!articleId || !authorName || !authorEmail || !content) {
      return NextResponse.json({ error: "articleId, authorName, authorEmail, and content are required" }, { status: 400 });
    }

    // Validate email format
    if (!EMAIL_RE.test(String(authorEmail))) {
      return NextResponse.json({ error: "Please enter a valid email address" }, { status: 400 });
    }

    // Sanitize all user input
    const cleanName = sanitizeText(String(authorName)).slice(0, 100);
    const cleanEmail = sanitizeText(String(authorEmail)).slice(0, 200);
    const cleanContent = sanitizeText(String(content)).slice(0, 2000);

    if (!cleanName || !cleanEmail || !cleanContent) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 });
    }

    await connectToDatabase();

    // Check if comments are enabled
    const settings = await SiteSettings.findOne().lean() as unknown as { enableComments?: boolean } | null;
    if (!settings?.enableComments) return NextResponse.json({ error: "Comments are disabled" }, { status: 403 });

    // Verify the article exists
    const article = await Article.findById(articleId).lean();
    if (!article) return NextResponse.json({ error: "Article not found" }, { status: 404 });

    const comment = await Comment.create({
      articleId,
      authorName: cleanName,
      authorEmail: cleanEmail,
      content: cleanContent,
      status: "pending", // Requires admin approval
    });

    return NextResponse.json({
      id: String(comment._id),
      authorName: comment.authorName,
      content: comment.content,
      createdAt: comment.createdAt,
      message: "Your comment has been submitted and is awaiting approval.",
    }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to post comment" }, { status: 500 });
  }
}
