import { XMLParser } from "fast-xml-parser";
import { connectToDatabase } from "./db";
import { Article, RssSource, RssImport, User, Media, SiteSettings } from "./models";
import { uploadFile, isStorageConfigured, getObjectUrl } from "./storage";
import { invalidateArticleCache } from "./redis";
import { createAuditLog } from "./data";
import { generateImageVariants } from "./image-optimize";
import { sanitizeRssContent, htmlToExcerpt, stripLeadingImages, stripAgencyArtifacts } from "./sanitize";
import crypto from "crypto";

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", trimValues: true });

const privateHost = (hostname: string) =>
  hostname === "localhost" ||
  hostname.endsWith(".local") ||
  /^127\.|^10\.|^192\.168\.|^169\.254\.|^0\./.test(hostname) ||
  /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname) ||
  hostname === "::1";

const text = (value: unknown): string =>
  typeof value === "string"
    ? value
    : value && typeof value === "object" && "#text" in value
      ? String((value as Record<string, unknown>)["#text"])
      : "";

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim();
}

function extractFirstImage(html: string): string | null {
  const match = html.match(/<img\b[^>]*\bsrc=["']([^"']+)["']/i);
  return match?.[1] ?? null;
}

function contentHash(title: string, content: string): string {
  const normalized = (title + content).toLowerCase().replace(/\s+/g, " ").trim().slice(0, 2000);
  return crypto.createHash("sha256").update(normalized).digest("hex");
}

function slugify(text: string): string {
  return text.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 80);
}

type FeedItem = {
  title: string;
  link: string;
  guid: string;
  publishedAt: string;
  summary: string;
  content: string;
  imageUrl: string | null;
};

type ImportResult = {
  sourceId: string;
  sourceName: string;
  status: "success" | "partial" | "failed";
  importedCount: number;
  skippedCount: number;
  error?: string;
  articles: { id: string; title: string; slug: string }[];
};

async function fetchFeed(feedUrl: string): Promise<{ title: string; items: FeedItem[] }> {
  const url = new URL(feedUrl);
  if (!/^https?:$/.test(url.protocol) || privateHost(url.hostname)) {
    throw new Error("Use a public HTTP or HTTPS feed URL.");
  }

  const response = await fetch(url, {
    headers: { Accept: "application/rss+xml, application/xml, text/xml" },
    signal: AbortSignal.timeout(15_000),
    redirect: "follow",
    cache: "no-store",
  });

  if (!response.ok) throw new Error(`Feed responded with ${response.status}`);

  const xml = await response.text();
  const document = parser.parse(xml);
  const channel = document.rss?.channel ?? document.feed;
  const rawItems = channel?.item ?? channel?.entry ?? [];
  const items = (Array.isArray(rawItems) ? rawItems : [rawItems]).slice(0, 25).map((item: Record<string, unknown>) => {
    const summary = text(item.description) || text(item.summary) || text(item.content).slice(0, 500) || "";
    const fullContent = text(item["content:encoded"]) || text(item.content) || summary;
    const imageUrl = extractFirstImage(fullContent) || extractFirstImage(summary);
    return {
      title: text(item.title) || "Untitled item",
      link: text(item.link) || text(item.guid) || "",
      guid: text(item.guid) || text(item.link) || "",
      publishedAt: text(item.pubDate) || text(item.published) || text(item.updated) || "",
      summary: stripHtml(summary).slice(0, 300),
      content: fullContent,
      imageUrl,
    };
  });

  return { title: text(channel?.title) || url.hostname, items };
}

async function downloadImage(imageUrl: string, altText: string, uploadedById: string): Promise<{ key: string; url: string; variants: { width: number; format: "webp" | "avif"; key: string; url: string; size: number }[]; width: number; height: number } | null> {
  if (!isStorageConfigured()) return null;
  try {
    const url = new URL(imageUrl);
    if (!/^https?:$/.test(url.protocol) || privateHost(url.hostname)) return null;

    const response = await fetch(imageUrl, {
      signal: AbortSignal.timeout(10_000),
      redirect: "follow",
      cache: "no-store",
    });
    if (!response.ok) return null;

    const contentType = response.headers.get("content-type") || "image/jpeg";
    if (!contentType.startsWith("image/")) return null;

    const buffer = Buffer.from(await response.arrayBuffer());
    const ext = contentType.split("/")[1]?.split(";")[0] || "jpg";
    const key = `rss-images/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
    const result = await uploadFile(key, buffer, contentType);

    // Generate optimized variants (WebP + AVIF at multiple widths)
    let variants: { width: number; format: "webp" | "avif"; key: string; url: string; size: number }[] = [];
    let imgWidth = 0;
    let imgHeight = 0;
    try {
      const optimized = await generateImageVariants(key, buffer, contentType);
      variants = optimized.variants;
      imgWidth = optimized.original.width;
      imgHeight = optimized.original.height;
    } catch { /* variant generation is best-effort */ }

    // Create a Media record so it appears in the media library
    const filename = imageUrl.split("/").pop()?.split("?")[0] || `rss-image.${ext}`;
    await Media.create({
      key: result.key,
      url: result.url,
      filename,
      contentType,
      size: buffer.length,
      width: imgWidth,
      height: imgHeight,
      alt: altText,
      caption: "",
      credit: "RSS import",
      uploadedById,
      variants,
    });

    return { key: result.key, url: result.url, variants, width: imgWidth, height: imgHeight };
  } catch {
    return null;
  }
}

async function findDuplicate(source: { guid: string; link: string; title: string; content: string }): Promise<{ _id: unknown; categoryIds: unknown[] } | null> {
  // Check by GUID
  if (source.guid) {
    const byGuid = await Article.findOne({ rssGuid: source.guid }).lean() as unknown as { _id: unknown; categoryIds?: unknown[] } | null;
    if (byGuid) return { _id: byGuid._id, categoryIds: (byGuid.categoryIds || []) as unknown[] };
  }
  // Check by source URL
  if (source.link) {
    const byUrl = await Article.findOne({ sourceUrl: source.link }).lean() as unknown as { _id: unknown; categoryIds?: unknown[] } | null;
    if (byUrl) return { _id: byUrl._id, categoryIds: (byUrl.categoryIds || []) as unknown[] };
  }
  // Check by content hash
  const hash = contentHash(source.title, source.content);
  const byHash = await Article.findOne({ contentHash: hash }).lean() as unknown as { _id: unknown; categoryIds?: unknown[] } | null;
  if (byHash) return { _id: byHash._id, categoryIds: (byHash.categoryIds || []) as unknown[] };
  return null;
}

export async function importRssSource(sourceId: string, actorId?: string): Promise<ImportResult> {
  await connectToDatabase();

  const source = await RssSource.findById(sourceId);
  if (!source) throw new Error("RSS source not found");

  const result: ImportResult = {
    sourceId: String(source._id),
    sourceName: source.name,
    status: "success",
    importedCount: 0,
    skippedCount: 0,
    articles: [],
  };

  try {
    const { items } = await fetchFeed(source.feedUrl);

    // Get the configured RSS default author name from settings
    const settings = await SiteSettings.findOne().lean() as unknown as { rssDefaultAuthor?: string } | null;
    const authorName = (settings?.rssDefaultAuthor as string) || "RSS Feed";

    // Find or create a system user for RSS articles
    let systemUser = await User.findOne({ email: "rss-system@behind-the-headlines.local" });
    if (!systemUser) {
      systemUser = await User.create({
        name: authorName,
        email: "rss-system@behind-the-headlines.local",
        passwordHash: crypto.randomBytes(32).toString("hex"),
        role: "editor",
        active: false,
      });
    } else if (systemUser.name !== authorName) {
      // Update the name if the setting has changed
      systemUser.name = authorName;
      await systemUser.save();
    }

    for (const item of items) {
      // Deduplication check
      const existing = await findDuplicate({ guid: item.guid, link: item.link, title: item.title, content: item.content });
      if (existing) {
        // If the existing article doesn't already have this source's category,
        // add it so the article appears in the correct category section.
        const existingCatIds = (existing.categoryIds || []).map(String);
        if (!existingCatIds.includes(String(source.categoryId))) {
          await Article.findByIdAndUpdate(existing._id, {
            $addToSet: { categoryIds: source.categoryId },
          });
          result.importedCount++;
        } else {
          result.skippedCount++;
        }
        continue;
      }

      // Sanitize HTML content, strip leading image and agency artifacts
      const sanitizedContent = stripAgencyArtifacts(stripLeadingImages(sanitizeRssContent(item.content)));
      const sanitizedSummary = htmlToExcerpt(sanitizedContent, 300);

      // Download image if present
      let featuredImage: { url: string; alt: string; width: number; height: number; variants: { width: number; format: "webp" | "avif"; key: string; url: string; size: number }[] } | undefined;
      if (item.imageUrl) {
        const downloaded = await downloadImage(item.imageUrl, item.title, String(systemUser._id));
        if (downloaded) {
          featuredImage = {
            url: downloaded.url,
            alt: item.title,
            width: downloaded.width,
            height: downloaded.height,
            variants: downloaded.variants,
          };
        }
      }

      // Generate unique slug
      const baseSlug = slugify(item.title) || `article-${Date.now()}`;
      let slug = baseSlug;
      let suffix = 1;
      while (await Article.findOne({ slug })) {
        slug = `${baseSlug}-${suffix++}`;
      }

      const hash = contentHash(item.title, sanitizedContent);
      const publishedAt = item.publishedAt ? new Date(item.publishedAt) : new Date();

      const article = await Article.create({
        title: item.title,
        slug,
        excerpt: sanitizedSummary,
        content: sanitizedContent,
        status: "published",
        origin: "rss",
        authorId: systemUser._id,
        categoryIds: [source.categoryId],
        featuredImage,
        publishedAt,
        sourceName: source.name,
        sourceUrl: item.link,
        rssGuid: item.guid,
        contentHash: hash,
      });

      result.importedCount++;
      result.articles.push({ id: String(article._id), title: article.title, slug: article.slug });
    }

    // Update source metadata
    source.lastRunAt = new Date();
    source.nextRunAt = new Date(Date.now() + source.intervalMinutes * 60 * 1000);
    source.lastError = null;
    source.lastImportedCount = result.importedCount;
    await source.save();

    // Record import history
    await RssImport.create({
      sourceId: source._id,
      status: result.importedCount > 0 ? "success" : "partial",
      importedCount: result.importedCount,
      skippedCount: result.skippedCount,
      articleIds: result.articles.map((a) => a.id),
    });

    // Invalidate article cache
    await invalidateArticleCache();

    // Audit log
    if (actorId) {
      await createAuditLog({
        actorId,
        action: `Fetched RSS source: ${source.name}`,
        entityType: "rss",
        entityId: String(source._id),
        metadata: { imported: result.importedCount, skipped: result.skippedCount },
      });
    }

    result.status = result.importedCount > 0 ? "success" : "partial";
    return result;
  } catch (error) {
    source.lastRunAt = new Date();
    source.lastError = error instanceof Error ? error.message : "Unknown error";
    await source.save();

    await RssImport.create({
      sourceId: source._id,
      status: "failed",
      importedCount: 0,
      skippedCount: 0,
      error: source.lastError,
    });

    result.status = "failed";
    result.error = source.lastError;
    return result;
  }
}

export async function importAllActiveSources(actorId?: string): Promise<ImportResult[]> {
  await connectToDatabase();
  const sources = await RssSource.find({ active: true });
  const results: ImportResult[] = [];
  for (const source of sources) {
    const result = await importRssSource(String(source._id), actorId);
    results.push(result);
  }
  return results;
}
