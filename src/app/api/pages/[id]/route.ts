import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { Page, Menu } from "@/lib/models";
import { getSession } from "@/lib/auth";

function slugify(text: string): string {
  return text.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || `page-${Date.now()}`;
}

// GET /api/pages/[id] — get a single page
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

    const { id } = await params;
    await connectToDatabase();
    const page = await Page.findById(id).lean();
    if (!page) return NextResponse.json({ error: "Page not found" }, { status: 404 });

    return NextResponse.json({
      id: String((page as Record<string, unknown>)._id),
      title: (page as Record<string, unknown>).title as string,
      slug: (page as Record<string, unknown>).slug as string,
      content: (page as Record<string, unknown>).content as string,
      excerpt: (page as Record<string, unknown>).excerpt as string,
      status: (page as Record<string, unknown>).status as string,
      seoTitle: (page as Record<string, unknown>).seoTitle as string,
      seoDescription: (page as Record<string, unknown>).seoDescription as string,
      createdAt: (page as Record<string, unknown>).createdAt as string,
      updatedAt: (page as Record<string, unknown>).updatedAt as string,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to fetch page" }, { status: 500 });
  }
}

// PUT /api/pages/[id] — update a page
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

    const { id } = await params;
    const body = await request.json();
    await connectToDatabase();

    const page = await Page.findById(id);
    if (!page) return NextResponse.json({ error: "Page not found" }, { status: 404 });

    const wasPublished = page.status === "published";

    if (body.title !== undefined) {
      page.title = String(body.title).trim();
      // Update slug only if title changed and page is a draft
      if (body.title && page.status === "draft") {
        const baseSlug = slugify(page.title);
        let slug = baseSlug;
        let suffix = 1;
        while (await Page.findOne({ slug, _id: { $ne: page._id } })) {
          slug = `${baseSlug}-${suffix++}`;
        }
        page.slug = slug;
      }
    }
    if (body.content !== undefined) page.content = body.content;
    if (body.excerpt !== undefined) page.excerpt = body.excerpt;
    if (body.status !== undefined) page.status = body.status;
    if (body.seoTitle !== undefined) page.seoTitle = body.seoTitle;
    if (body.seoDescription !== undefined) page.seoDescription = body.seoDescription;

    await page.save();

    // Auto-add to footer menu when first published
    if (!wasPublished && page.status === "published") {
      await addPageToFooterMenu(page.title, `/page/${page.slug}`);
    }

    return NextResponse.json({
      id: String(page._id),
      title: page.title,
      slug: page.slug,
      status: page.status,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to update page" }, { status: 500 });
  }
}

// DELETE /api/pages/[id] — delete a page
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

    const { id } = await params;
    await connectToDatabase();
    const page = await Page.findById(id);
    if (!page) return NextResponse.json({ error: "Page not found" }, { status: 404 });

    // Remove from footer menu if present
    await removePageFromMenus(`/page/${page.slug}`);

    await Page.findByIdAndDelete(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to delete page" }, { status: 500 });
  }
}

async function addPageToFooterMenu(label: string, href: string) {
  try {
    let footerMenu = await Menu.findOne({ location: "footer" });
    if (!footerMenu) {
      footerMenu = await Menu.create({ location: "footer", items: [] });
    }
    const exists = footerMenu.items.some((item: { href: string }) => item.href === href);
    if (!exists) {
      footerMenu.items.push({ label, href, order: footerMenu.items.length, visible: true });
      await footerMenu.save();
    }
  } catch { /* ignore */ }
}

async function removePageFromMenus(href: string) {
  try {
    const menus = await Menu.find({});
    for (const menu of menus) {
      const before = menu.items.length;
      menu.items = menu.items.filter((item: { href: string }) => item.href !== href);
      if (menu.items.length !== before) {
        menu.items = menu.items.map((item: { label: string; href: string; order: number; visible: boolean }, i: number) => ({ ...item, order: i }));
        await menu.save();
      }
    }
  } catch { /* ignore */ }
}
