import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { Article, RssSource, User } from "@/lib/models";
import { sanitizeRssContent, stripLeadingImages, stripAgencyArtifacts } from "@/lib/sanitize";
import { createHash } from "crypto";

export const dynamic = "force-dynamic";

// Maps IANS tag slugs to our RSS source names, with priority.
// IANS tags every article with "national" as a generic tag, so we need
// priority ordering — specific category tags must win over "national".
const TAG_PRIORITY: Array<{ tags: string[]; source: string }> = [
  { tags: ["sports", "cricket", "football", "other-sports", "motorsports", "fifa-worldcup-2026"], source: "IANS - Sports" },
  { tags: ["entertainment", "cinema", "music"], source: "IANS - Entertainment" },
  { tags: ["business", "economy", "markets"], source: "IANS - Business" },
  { tags: ["science", "technology", "environment"], source: "IANS - Science/Tech" },
  { tags: ["health", "lifestyle"], source: "IANS - Health/Medicine" },
  { tags: ["international", "diplomacy", "security", "terrorism", "defence"], source: "IANS - World" },
  { tags: ["national", "politics", "crime", "law", "society", "education", "disaster", "accident", "religion", "human-interest", "opinion-specials"], source: "IANS - NAtional" },
];

function sourceFromTags(tagSlugs: string[]): string {
  for (const group of TAG_PRIORITY) {
    for (const tag of tagSlugs) {
      if (group.tags.includes(tag)) return group.source;
    }
  }
  return "IANS - All News";
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

function contentHash(title: string, content: string): string {
  const normalized = (title + "|" + stripHtml(content).slice(0, 500)).toLowerCase().replace(/\s+/g, " ").trim();
  return createHash("md5").update(normalized).digest("hex");
}

/**
 * Extracts the dateline from the IANS short_desc field and prepends it
 * to the content's first paragraph.
 *
 * The IANS CMS API returns content WITHOUT the dateline (e.g., "<p>The Chief Minister..."),
 * but short_desc has it: "Amaravati, July 12 (IANS) Andhra Pradesh Chief Minister..."
 *
 * The RSS feed format includes the dateline in the first paragraph:
 *   "<p>Panaji (Goa), July 18 — Defending champions...</p>"
 *
 * This function converts the short_desc dateline to the RSS format and
 * prepends it to the first <p> tag of the content.
 */
function prependDateline(content: string, shortDesc?: string): string {
  if (!shortDesc || !content) return content;

  // Extract dateline from short_desc: "Place, Date (IANS) Rest of text..."
  // e.g., "Amaravati, July 12 (IANS) Andhra Pradesh Chief Minister..."
  const datelineMatch = shortDesc.match(/^(.+?\(IANS\))\s+/);
  if (!datelineMatch) return content;

  // Convert "(IANS)" to "—" to match RSS feed format
  // "Amaravati, July 12 (IANS)" -> "Amaravati, July 12 —"
  const dateline = datelineMatch[1].replace(/\s*\(IANS\)\s*$/, " —").trim();

  // Prepend dateline to the first <p> tag
  if (content.startsWith("<p>")) {
    return "<p>" + dateline + " " + content.slice(3);
  } else if (content.startsWith("<p ")) {
    const tagEnd = content.indexOf(">");
    if (tagEnd >= 0) {
      return content.slice(0, tagEnd + 1) + dateline + " " + content.slice(tagEnd + 1);
    }
  }

  // If content doesn't start with <p>, wrap the dateline in a <p>
  return "<p>" + dateline + "</p>" + content;
}

type IansListItem = {
  id: number;
  uuid: string;
  title: string;
  slug: string;
  short_desc?: string;
  image?: string;
  thumbnail?: string;
  image_caption?: string;
  created_at: string;
  tags?: Array<{ id: number; name: string; slug: string }>;
};

type IansDetailResult = {
  content?: string;
  title?: string;
  byline?: string;
  short_desc?: string;
  image_caption?: string;
};

type RecoverableArticle = {
  slug: string;
  sourceUrl: string;
  title: string;
  excerpt: string;
  sourceName: string;
  createdAt: string;
  imageUrl: string;
  imageCaption: string;
  tags: string[];
};

/**
 * GET /api/recover?from=YYYY-MM-DD&to=YYYY-MM-DD&token=...
 *
 * Streams progress updates as newline-delimited JSON (NDJSON).
 * Each line is a JSON object with a "type" field:
 *   - { type: "log", message: "..." }            — progress log line
 *   - { type: "stats", ... }                      — intermediate stats
 *   - { type: "result", articles: [...], ... }    — final result
 *   - { type: "error", message: "..." }           — error
 */
export async function GET(request: Request) {
  try {
    await requireAdmin();
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Admin access required" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");
  if (!fromParam) {
    return NextResponse.json({ error: "From date is required (YYYY-MM-DD)" }, { status: 400 });
  }

  const iansToken = searchParams.get("token");
  if (!iansToken) {
    return NextResponse.json({ error: "IANS token is required" }, { status: 400 });
  }

  const fromCutoff = new Date(fromParam + "T00:00:00.000Z");
  if (isNaN(fromCutoff.getTime())) {
    return NextResponse.json({ error: "Invalid from date format. Use YYYY-MM-DD." }, { status: 400 });
  }

  // "to" date is optional — if provided, set to end of that day; if not, no upper bound
  let toCutoff: Date | null = null;
  if (toParam) {
    toCutoff = new Date(toParam + "T23:59:59.999Z");
    if (isNaN(toCutoff.getTime())) {
      return NextResponse.json({ error: "Invalid to date format. Use YYYY-MM-DD." }, { status: 400 });
    }
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function send(obj: unknown) {
        controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
      }

      try {
        send({ type: "log", message: `Connecting to database...` });
        await connectToDatabase();

        // Load existing article URLs/GUIDs for dedup
        const existing = await Article.find({ origin: "rss" }, { sourceUrl: 1, rssGuid: 1 }).lean();
        const existingUrls = new Set(existing.map((a: Record<string, unknown>) => a.sourceUrl).filter(Boolean));
        const existingGuids = new Set(existing.map((a: Record<string, unknown>) => a.rssGuid).filter(Boolean));
        send({ type: "log", message: `Existing articles in DB: ${existing.length}` });

        // Load RSS sources
        const sources = await RssSource.find().lean() as unknown as Array<Record<string, unknown>>;
        send({ type: "log", message: `RSS sources loaded: ${sources.length}` });
        send({ type: "log", message: `Date range: ${fromCutoff.toISOString().slice(0, 10)} to ${toCutoff ? toCutoff.toISOString().slice(0, 10) : "now"}` });
        send({ type: "log", message: `Fetching articles from IANS CMS API...` });

        const candidates: RecoverableArticle[] = [];
        const sourceCounts = new Map<string, number>();
        const tagCounts = new Map<string, number>();
        let totalScanned = 0;
        let page = 1;
        let tooOld = false;
        const maxPages = 300;

        while (!tooOld && page <= maxPages) {
          const url = `https://cms.iansnews.in/api/elastic/news/list/?language=english&website=1&page=${page}`;
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
            // Stop if article is older than the "from" date
            if (createdAt < fromCutoff) {
              tooOld = true;
              continue;
            }
            // Skip if article is newer than the "to" date (but keep scanning — API is newest-first)
            if (toCutoff && createdAt > toCutoff) {
              continue;
            }
            totalScanned++;

            const sourceUrl = `https://ians.in/detail/${r.slug}/`;
            if (existingUrls.has(sourceUrl) || existingGuids.has(r.slug)) continue;

            const tagSlugs = (r.tags || []).map((t) => t.slug);
            const sourceName = sourceFromTags(tagSlugs);

            candidates.push({
              slug: r.slug,
              sourceUrl,
              title: r.title,
              excerpt: r.short_desc || "",
              sourceName,
              createdAt: r.created_at,
              imageUrl: r.image || r.thumbnail || "",
              imageCaption: r.image_caption || "",
              tags: tagSlugs,
            });

            sourceCounts.set(sourceName, (sourceCounts.get(sourceName) || 0) + 1);
            for (const ts of tagSlugs) {
              tagCounts.set(ts, (tagCounts.get(ts) || 0) + 1);
            }
          }

          // Log progress every 5 pages
          if (page % 5 === 0) {
            send({ type: "log", message: `Scanned page ${page}... (${totalScanned} articles checked, ${candidates.length} new found)` });
          }

          page++;
          await new Promise((r) => setTimeout(r, 300));
        }

        // Send summary
        send({
          type: "log",
          message: `\n=== RESULTS ===\nTotal articles found since cutoff: ${totalScanned}\nNew articles (not in DB): ${candidates.length}`,
        });

        // Category breakdown
        let catBreakdown = "\n--- New articles by source/category ---";
        const sortedSources = [...sourceCounts.entries()].sort((a, b) => b[1] - a[1]);
        for (const [source, count] of sortedSources) {
          catBreakdown += `\n  ${source}: ${count} articles`;
        }
        if (candidates.length === 0) catBreakdown += "\n  (none)";
        send({ type: "log", message: catBreakdown });

        // Tag breakdown
        let tagBreakdown = "\n--- New articles by IANS tag ---";
        const sortedTags = [...tagCounts.entries()].sort((a, b) => b[1] - a[1]);
        for (const [tag, count] of sortedTags) {
          tagBreakdown += `\n  ${tag}: ${count}`;
        }
        if (sortedTags.length === 0) tagBreakdown += "\n  (none)";
        send({ type: "log", message: tagBreakdown });

        // Send final result
        send({
          type: "result",
          articles: candidates,
          scanned: page - 1,
          from: fromCutoff.toISOString(),
          to: toCutoff ? toCutoff.toISOString() : null,
          totalScanned,
          sourceCounts: sortedSources,
          tagCounts: sortedTags,
        });
      } catch (error) {
        send({ type: "error", message: error instanceof Error ? error.message : "Failed to scan IANS API" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache",
    },
  });
}

/**
 * POST /api/recover
 * Body: { articles: [{ slug, sourceName, title }] }
 * Fetches full content for each selected article from the IANS detail API
 * and saves them to the database. Streams progress as NDJSON.
 */
export async function POST(request: Request) {
  try {
    await requireAdmin();
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Admin access required" }, { status: 403 });
  }

  const body = await request.json();
  const articles: Array<{ slug: string; sourceName: string; title: string }> = body.articles;
  const iansToken: string = body.token;
  if (!iansToken) {
    return NextResponse.json({ error: "IANS token is required" }, { status: 400 });
  }
  if (!Array.isArray(articles) || articles.length === 0) {
    return NextResponse.json({ error: "No articles selected" }, { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function send(obj: unknown) {
        controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
      }

      try {
        send({ type: "log", message: `Connecting to database...` });
        await connectToDatabase();

        // Load RSS sources
        const sources = await RssSource.find().lean() as unknown as Array<Record<string, unknown>>;
        const sourceMap = new Map<string, Record<string, unknown>>();
        for (const s of sources) sourceMap.set(s.name as string, s);

        // Find a default author
        const adminUser = await User.findOne({ role: "admin" }).lean();
        const anyUser = adminUser || await User.findOne().lean();
        if (!anyUser) {
          send({ type: "error", message: "No user found in database" });
          controller.close();
          return;
        }
        const authorId = (anyUser as Record<string, unknown>)._id;

        send({ type: "log", message: `Saving ${articles.length} articles from IANS...` });

        const imported: Array<{ slug: string; title: string }> = [];
        const skipped: Array<{ slug: string; title: string; reason: string }> = [];
        const failed: Array<{ slug: string; title: string; error: string }> = [];

        for (let i = 0; i < articles.length; i++) {
          const article = articles[i];
          try {
            const sourceUrl = `https://ians.in/detail/${article.slug}/`;
            const existing = await Article.findOne({ $or: [{ sourceUrl }, { rssGuid: article.slug }] }).lean();
            if (existing) {
              skipped.push({ slug: article.slug, title: article.title, reason: "Already exists" });
              send({ type: "log", message: `  [${i + 1}/${articles.length}] Skipped (exists): ${article.title.slice(0, 50)}` });
              continue;
            }

            const detailUrl = `https://cms.iansnews.in/api/elastic/news/detail/en/${article.slug}/?language=english&website=1`;
            const detailRes = await fetch(detailUrl, {
              headers: {
                "User-Agent": "Mozilla/5.0",
                Referer: "https://ians.in/",
                Authorization: `Bearer ${iansToken}`,
              },
              signal: AbortSignal.timeout(15000),
            });

            if (!detailRes.ok) {
              failed.push({ slug: article.slug, title: article.title, error: `Detail API ${detailRes.status}` });
              send({ type: "log", message: `  [${i + 1}/${articles.length}] Failed (API ${detailRes.status}): ${article.title.slice(0, 50)}` });
              continue;
            }

            const detailData = await detailRes.json();
            const results: IansDetailResult[] = detailData.results || [];
            if (results.length === 0 || !results[0].content) {
              failed.push({ slug: article.slug, title: article.title, error: "No content" });
              send({ type: "log", message: `  [${i + 1}/${articles.length}] Failed (no content): ${article.title.slice(0, 50)}` });
              continue;
            }

            const rawContent = results[0].content;
            const shortDesc = results[0].short_desc;
            const sanitized = sanitizeRssContent(rawContent);
            const withoutLeading = stripLeadingImages(sanitized);
            const withDateline = prependDateline(withoutLeading, shortDesc);
            const cleaned = stripAgencyArtifacts(withDateline);
            const excerpt = stripHtml(cleaned).slice(0, 300);
            const hash = contentHash(article.title, cleaned);

            const existingHash = await Article.findOne({ contentHash: hash }).lean();
            if (existingHash) {
              skipped.push({ slug: article.slug, title: article.title, reason: "Duplicate content hash" });
              send({ type: "log", message: `  [${i + 1}/${articles.length}] Skipped (dup hash): ${article.title.slice(0, 50)}` });
              continue;
            }

            const source = sourceMap.get(article.sourceName);
            const categoryIds = source?.categoryIds || (source?.categoryId ? [source.categoryId] : []);

            let featuredImage: Record<string, unknown> | null = null;
            const imageUrl = body.imageMap?.[article.slug];
            if (imageUrl) {
              featuredImage = { url: imageUrl, alt: article.title, caption: "", credit: "", width: 0, height: 0, variants: [] };
            }

            const dateMatch = article.slug.match(/--(\d{14})$/);
            const publishedAt = dateMatch ? new Date(
              `${dateMatch[1].slice(0, 4)}-${dateMatch[1].slice(4, 6)}-${dateMatch[1].slice(6, 8)}` +
              `T${dateMatch[1].slice(8, 10)}:${dateMatch[1].slice(10, 12)}:${dateMatch[1].slice(12, 14)}Z`
            ) : new Date();

            await Article.create({
              title: article.title,
              slug: article.slug,
              excerpt,
              content: cleaned,
              status: "published",
              origin: "rss",
              authorId,
              categoryIds,
              tagIds: [],
              featuredImage,
              publishedAt,
              sourceName: article.sourceName,
              sourceUrl,
              rssGuid: article.slug,
              contentHash: hash,
            });

            imported.push({ slug: article.slug, title: article.title });
            send({ type: "log", message: `  [${i + 1}/${articles.length}] Imported: ${article.title.slice(0, 50)}` });
          } catch (err) {
            failed.push({ slug: article.slug, title: article.title, error: err instanceof Error ? err.message : "Unknown error" });
            send({ type: "log", message: `  [${i + 1}/${articles.length}] Error: ${article.title.slice(0, 40)} — ${err instanceof Error ? err.message : "unknown"}` });
          }
        }

        send({
          type: "log",
          message: `\n=== SAVE COMPLETE ===\nImported: ${imported.length}\nSkipped: ${skipped.length}\nFailed: ${failed.length}`,
        });

        send({ type: "result", imported, skipped, failed });
      } catch (error) {
        send({ type: "error", message: error instanceof Error ? error.message : "Failed to save articles" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache",
    },
  });
}
