import { NextResponse } from "next/server";
import { getArticleById, updateArticle, deleteArticle } from "@/lib/data";
import { getSession, canManageArticle } from "@/lib/auth";

type ArticleDoc = { id: string; authorId?: string; [key: string]: unknown };

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    const { id } = await params;
    const article = await getArticleById(id) as ArticleDoc | null;
    if (!article) return NextResponse.json({ error: "Article not found" }, { status: 404 });
    if (session.role === "editor" && String(article.authorId) !== session.id) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
    return NextResponse.json(article);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to fetch article" }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    const { id } = await params;
    const article = await getArticleById(id) as ArticleDoc | null;
    if (!article) return NextResponse.json({ error: "Article not found" }, { status: 404 });
    if (!canManageArticle(session, String(article.authorId))) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
    const body = await request.json();
    const updated = await updateArticle(id, body);
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to update article" }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    const { id } = await params;
    const article = await getArticleById(id) as ArticleDoc | null;
    if (!article) return NextResponse.json({ error: "Article not found" }, { status: 404 });
    if (!canManageArticle(session, String(article.authorId))) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
    await deleteArticle(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to delete article" }, { status: 500 });
  }
}
