import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { Page, Menu } from "@/lib/models";
import { requireAdmin, errorStatus } from "@/lib/auth";

function slugify(text: string): string {
  return text.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || `page-${Date.now()}`;
}

// GET /api/pages — list all pages (admin only)
export async function GET(request: Request) {
  try {
    await requireAdmin();

    await connectToDatabase();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || undefined;

    const query: Record<string, unknown> = {};
    if (status) query.status = status;

    const pages = await Page.find(query).sort({ updatedAt: -1 }).lean();

    return NextResponse.json({
      pages: pages.map((p) => ({
        id: String((p as Record<string, unknown>)._id),
        title: (p as Record<string, unknown>).title as string,
        slug: (p as Record<string, unknown>).slug as string,
        status: (p as Record<string, unknown>).status as string,
        excerpt: (p as Record<string, unknown>).excerpt as string,
        updatedAt: (p as Record<string, unknown>).updatedAt as string,
        createdAt: (p as Record<string, unknown>).createdAt as string,
      })),
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to fetch pages" }, { status: errorStatus(error) });
  }
}

// POST /api/pages — create a new page (admin only)
export async function POST(request: Request) {
  try {
    const session = await requireAdmin();

    const { title, content, excerpt, status, seoTitle, seoDescription } = await request.json();
    if (!title || !title.trim()) return NextResponse.json({ error: "Title is required" }, { status: 400 });

    await connectToDatabase();

    // Generate unique slug
    const baseSlug = slugify(title);
    let slug = baseSlug;
    let suffix = 1;
    while (await Page.findOne({ slug })) {
      slug = `${baseSlug}-${suffix++}`;
    }

    const page = await Page.create({
      title: String(title).trim(),
      slug,
      content: content || "",
      excerpt: excerpt || "",
      status: status || "draft",
      seoTitle: seoTitle || "",
      seoDescription: seoDescription || "",
      authorId: session.id,
    });

    // If published, auto-add to footer menu (master menu list)
    if (status === "published") {
      await addPageToFooterMenu(page.title, `/page/${page.slug}`);
    }

    return NextResponse.json({
      id: String(page._id),
      title: page.title,
      slug: page.slug,
      status: page.status,
    }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to create page" }, { status: errorStatus(error) });
  }
}

// Helper: add a page link to the footer menu
async function addPageToFooterMenu(label: string, href: string) {
  try {
    let footerMenu = await Menu.findOne({ location: "footer" });
    if (!footerMenu) {
      footerMenu = await Menu.create({ location: "footer", items: [] });
    }
    // Check if already exists
    const exists = footerMenu.items.some((item: { href: string }) => item.href === href);
    if (!exists) {
      footerMenu.items.push({ label, href, order: footerMenu.items.length, visible: true });
      await footerMenu.save();
    }
  } catch {
    // Don't fail the page creation if menu update fails
  }
}
