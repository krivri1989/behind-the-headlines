import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { sanitizeRssContent, stripLeadingImages, stripAgencyArtifacts } from "@/lib/sanitize";

export const dynamic = "force-dynamic";

/**
 * GET /api/hindi?mode=list&from=YYYY-MM-DD&to=YYYY-MM-DD&token=...
 * GET /api/hindi?mode=detail&slug=...&token=...
 *
 * Proxies the IANS CMS API for Hindi news. Does NOT save anything to the database.
 * - mode=list:   Streams progress as NDJSON, returns article list (metadata only)
 * - mode=detail: Returns full article content for a single article
 */
export async function GET(request: Request) {
  try {
    await requireAdmin();
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Admin access required" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("mode") || "list";
  const iansToken = searchParams.get("token");
  if (!iansToken) {
    return NextResponse.json({ error: "IANS token is required" }, { status: 400 });
  }

  if (mode === "detail") {
    return handleDetail(searchParams, iansToken);
  }
  return handleList(searchParams, iansToken);
}

type HindiArticle = {
  slug: string;
  title: string;
  shortDesc: string;
  createdAt: string;
  imageUrl: string;
  imageCaption: string;
  tags: string[];
};

type IansListItem = {
  id: number;
  title: string;
  slug: string;
  short_desc?: string;
  image?: string;
  thumbnail?: string;
  image_caption?: string;
  created_at: string;
  tags?: Array<{ id: number; name: string; slug: string }>;
};

/**
 * Streams the Hindi article list as NDJSON (same pattern as /api/recover).
 */
async function handleList(searchParams: URLSearchParams, iansToken: string) {
  const fromParam = searchParams.get("from");
  if (!fromParam) {
    return NextResponse.json({ error: "From date is required" }, { status: 400 });
  }

  const fromCutoff = new Date(fromParam + "T00:00:00.000Z");
  if (isNaN(fromCutoff.getTime())) {
    return NextResponse.json({ error: "Invalid from date" }, { status: 400 });
  }

  const toParam = searchParams.get("to");
  let toCutoff: Date | null = null;
  if (toParam) {
    toCutoff = new Date(toParam + "T23:59:59.999Z");
    if (isNaN(toCutoff.getTime())) {
      return NextResponse.json({ error: "Invalid to date" }, { status: 400 });
    }
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function send(obj: unknown) {
        controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
      }

      try {
        send({ type: "log", message: `Date range: ${fromCutoff.toISOString().slice(0, 10)} to ${toCutoff ? toCutoff.toISOString().slice(0, 10) : "now"}` });
        send({ type: "log", message: `Fetching Hindi articles from IANS CMS API...` });

        const articles: HindiArticle[] = [];
        const tagCounts = new Map<string, number>();
        let totalScanned = 0;
        let page = 1;
        let tooOld = false;
        const maxPages = 1100;

        while (!tooOld && page <= maxPages) {
          const url = `https://cms.iansnews.in/api/elastic/news/list/?language=hindi&website=1&page=${page}`;
          const res = await fetch(url, {
            headers: {
              "User-Agent": "Mozilla/5.0",
              Referer: "https://ians.in/",
              Authorization: `Bearer ${iansToken}`,
            },
            signal: AbortSignal.timeout(15000),
          });

          if (!res.ok) {
            send({ type: "log", message: `Page ${page}: API returned ${res.status}, stopping.` });
            break;
          }

          const data = await res.json();
          const results: IansListItem[] = data.results || [];
          if (results.length === 0) {
            send({ type: "log", message: `Page ${page}: no results, stopping.` });
            break;
          }

          for (const r of results) {
            const createdAt = new Date(r.created_at);
            if (createdAt < fromCutoff) {
              tooOld = true;
              continue;
            }
            if (toCutoff && createdAt > toCutoff) {
              continue;
            }
            totalScanned++;

            const tagSlugs = (r.tags || []).map((t) => t.slug);
            for (const ts of tagSlugs) {
              tagCounts.set(ts, (tagCounts.get(ts) || 0) + 1);
            }
            articles.push({
              slug: r.slug,
              title: r.title,
              shortDesc: r.short_desc || "",
              createdAt: r.created_at,
              imageUrl: r.image || r.thumbnail || "",
              imageCaption: r.image_caption || "",
              tags: tagSlugs,
            });
          }

          if (page % 5 === 0) {
            send({ type: "log", message: `Scanned page ${page}... (${totalScanned} articles found)` });
          }

          page++;
          await new Promise((r) => setTimeout(r, 300));
        }

        send({
          type: "log",
          message: `\n=== RESULTS ===\nTotal Hindi articles found: ${articles.length}\nScanned ${page - 1} API pages.`,
        });

        // Category/tag breakdown
        const sortedTags = [...tagCounts.entries()].sort((a, b) => b[1] - a[1]);
        let tagBreakdown = "\n--- Articles by category (IANS tag) ---";
        for (const [tag, count] of sortedTags) {
          tagBreakdown += `\n  ${tag}: ${count}`;
        }
        if (sortedTags.length === 0) tagBreakdown += "\n  (none)";
        send({ type: "log", message: tagBreakdown });

        send({ type: "result", articles, totalScanned, pages: page - 1, tagCounts: sortedTags });
      } catch (error) {
        send({ type: "error", message: error instanceof Error ? error.message : "Failed to fetch Hindi news" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-cache" },
  });
}

/**
 * Fetches a single Hindi article's full content from the IANS detail API.
 * Does NOT save to database. Returns sanitized content with dateline.
 */
async function handleDetail(searchParams: URLSearchParams, iansToken: string) {
  const slug = searchParams.get("slug");
  if (!slug) {
    return NextResponse.json({ error: "Slug is required" }, { status: 400 });
  }

  try {
    const url = `https://cms.iansnews.in/api/elastic/news/detail/hi/${slug}/?language=hindi`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        Referer: "https://ians.in/",
        Authorization: `Bearer ${iansToken}`,
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      return NextResponse.json({ error: `IANS API returned ${res.status}` }, { status: res.status });
    }

    const data = await res.json();
    const result = data.results?.[0];
    if (!result) {
      return NextResponse.json({ error: "Article not found" }, { status: 404 });
    }

    const rawContent = result.content || "";
    const shortDesc = result.short_desc || "";
    const sanitized = sanitizeRssContent(rawContent);
    const withoutLeading = stripLeadingImages(sanitized);

    // Prepend Hindi dateline from short_desc
    // Format: "नई दिल्ली, 20 जुलाई (आईएएनएस)। rest of text..."
    // Convert to: "नई दिल्ली, 20 जुलाई — rest of content..."
    let content = withoutLeading;
    const datelineMatch = shortDesc.match(/^(.+?\(आईएएनएस\))।?\s*/);
    if (datelineMatch) {
      const dateline = datelineMatch[1].replace(/\s*\(आईएएनएस\)\s*$/, " —").trim();
      if (content.startsWith("<p>")) {
        content = "<p>" + dateline + " " + content.slice(3);
      } else if (content.startsWith("<p ")) {
        const tagEnd = content.indexOf(">");
        if (tagEnd >= 0) {
          content = content.slice(0, tagEnd + 1) + dateline + " " + content.slice(tagEnd + 1);
        }
      } else {
        content = "<p>" + dateline + "</p>" + content;
      }
    }

    const cleaned = stripAgencyArtifacts(content);

    return NextResponse.json({
      title: result.title,
      content: cleaned,
      shortDesc,
      imageUrl: result.image || result.thumbnail || "",
      imageCaption: result.image_caption || "",
      byline: result.byline || "IANS",
      createdAt: result.created_at,
      tags: (result.tags || []).map((t: { slug: string; name: string }) => ({ slug: t.slug, name: t.name })),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch article" },
      { status: 500 }
    );
  }
}
