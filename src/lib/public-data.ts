import { connectToDatabase } from "./db";
import { Article, Category, Menu, SiteSettings, Tag, Subscriber, Advertisement, SponsoredContent } from "./models";
import { cacheGet, cacheSet } from "./redis";
import crypto from "crypto";

// --- Types -----------------------------------------------------------------

export type PublicArticle = {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  status: string;
  origin: string;
  author: { id: string; name: string };
  categories: { id: string; name: string; slug: string }[];
  tags: { id: string; name: string; slug: string }[];
  featuredImage: { url: string; alt: string; caption: string; credit: string; width: number; height: number; variants: { width: number; format: string; key: string; url: string; size: number }[] } | null;
  publishedAt: string;
  updatedAt: string;
  sourceName: string | null;
  sourceUrl: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
};

export type PublicCategory = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
};

export type PublicMenuItem = {
  label: string;
  href: string;
  order: number;
  visible: boolean;
};

// --- Helpers ---------------------------------------------------------------

function toPublicArticle(a: Record<string, unknown>): PublicArticle {
  const author = a.authorId as Record<string, unknown> | null;
  const categories = Array.isArray(a.categoryIds) ? a.categoryIds.map((c: Record<string, unknown>) => ({
    id: String(c._id), name: String(c.name), slug: String(c.slug),
  })) : [];
  const tags = Array.isArray(a.tagIds) ? a.tagIds.map((t: Record<string, unknown>) => ({
    id: String(t._id), name: String(t.name), slug: String(t.slug),
  })) : [];
  const fi = a.featuredImage as Record<string, unknown> | null;
  return {
    id: String(a._id),
    title: String(a.title),
    slug: String(a.slug),
    excerpt: String(a.excerpt || ""),
    content: String(a.content || ""),
    status: String(a.status),
    origin: String(a.origin),
    author: author ? { id: String(author._id), name: String(author.name) } : { id: "", name: "Unknown" },
    categories,
    tags,
    featuredImage: fi && fi.url ? {
      url: String(fi.url),
      alt: String(fi.alt || ""),
      caption: String(fi.caption || ""),
      credit: String(fi.credit || ""),
      width: Number(fi.width || 0),
      height: Number(fi.height || 0),
      variants: Array.isArray(fi.variants) ? fi.variants.map((v: Record<string, unknown>) => ({
        width: Number(v.width), format: String(v.format), key: String(v.key), url: String(v.url), size: Number(v.size),
      })) : [],
    } : null,
    publishedAt: a.publishedAt ? new Date(a.publishedAt as string).toISOString() : new Date().toISOString(),
    updatedAt: a.updatedAt ? new Date(a.updatedAt as string).toISOString() : new Date().toISOString(),
    sourceName: a.sourceName ? String(a.sourceName) : null,
    sourceUrl: a.sourceUrl ? String(a.sourceUrl) : null,
    seoTitle: a.seoTitle ? String(a.seoTitle) : null,
    seoDescription: a.seoDescription ? String(a.seoDescription) : null,
  };
}

// --- Public Queries --------------------------------------------------------

const defaultSiteSettings: Record<string, unknown> = {
  publicationName: "Behind The Headlines",
  tagline: "Independent reporting, analysis, and stories that matter.",
  language: "English",
  timezone: "Asia/Kolkata",
  contactEmail: "",
  seoTitle: "Behind The Headlines | Independent News",
  metaDescription: "Independent reporting, analysis, and stories that matter.",
  keywords: "news, india, business, technology, world",
  canonicalHost: "",
  primaryColor: "#4b2739",
  primaryTextColor: "#ffffff",
  accentColor: "#bd8b32",
  accentTextColor: "#ffffff",
  footerColor: "#1a1a1a",
  footerTextColor: "#ffffff",
  logoUrl: "https://media.behindtheheadlines.in/behind-the-headlines-media/media/1784439072427-auz5ye.jpg",
  faviconUrl: "",
  defaultImageUrl: "",
};

export async function getSiteSettingsPublic(): Promise<Record<string, unknown>> {
  const cached = await cacheGet<Record<string, unknown>>("cache:public:settings");
  if (cached) return cached;
  await connectToDatabase();
  const settings = await SiteSettings.findOne().lean() as Record<string, unknown> | null;
  const result = { ...defaultSiteSettings, ...settings, id: settings ? String(settings._id) : "default" } as Record<string, unknown>;
  delete result._id;
  delete result.__v;
  await cacheSet("cache:public:settings", result, 600);
  return result;
}

export async function getVisibleCategories(): Promise<PublicCategory[]> {
  const cached = await cacheGet<PublicCategory[]>("cache:public:categories");
  if (cached) return cached;
  await connectToDatabase();
  const cats = await Category.find({ visible: true }).sort({ order: 1, name: 1 }).lean() as unknown as Record<string, unknown>[];
  const result = cats.map((c) => ({
    id: String(c._id), name: String(c.name), slug: String(c.slug),
    description: c.description ? String(c.description) : null,
  }));
  await cacheSet("cache:public:categories", result, 600);
  return result;
}

export async function getPublicMenu(location: "header" | "footer"): Promise<PublicMenuItem[]> {
  const cacheKey = location === "header" ? "cache:public:menu-header" : "cache:public:menu-footer";
  const cached = await cacheGet<PublicMenuItem[]>(cacheKey);
  if (cached) return cached;
  await connectToDatabase();
  const menu = await Menu.findOne({ location }).lean() as unknown as Record<string, unknown> | null;
  const items = menu && Array.isArray(menu.items)
    ? (menu.items as Record<string, unknown>[]).map((item) => ({
        label: String(item.label || ""),
        href: String(item.href || ""),
        order: Number(item.order || 0),
        visible: Boolean(item.visible),
      })).filter((i) => i.visible).sort((a, b) => a.order - b.order)
    : [];
  await cacheSet(cacheKey, items, 600);
  return items;
}

export async function getLeadStory(): Promise<PublicArticle | null> {
  const cached = await cacheGet<PublicArticle>("cache:public:lead");
  if (cached) return cached;
  await connectToDatabase();
  const article = await Article.findOne({ status: "published" })
    .sort({ publishedAt: -1 })
    .populate("authorId", "name")
    .populate("categoryIds", "name slug")
    .populate("tagIds", "name slug")
    .lean() as unknown as Record<string, unknown> | null;
  if (!article) return null;
  const result = toPublicArticle(article);
  await cacheSet("cache:public:lead", result, 300);
  return result;
}

export async function getSecondaryStories(limit = 5, excludeId?: string): Promise<PublicArticle[]> {
  await connectToDatabase();
  const filter: Record<string, unknown> = { status: "published" };
  if (excludeId) filter._id = { $ne: excludeId };
  const articles = await Article.find(filter)
    .sort({ publishedAt: -1 })
    .skip(excludeId ? 1 : 0)
    .limit(limit)
    .populate("authorId", "name")
    .populate("categoryIds", "name slug")
    .lean() as unknown as Record<string, unknown>[];
  return articles.map(toPublicArticle);
}

export async function getLatestNews(limit = 15): Promise<PublicArticle[]> {
  await connectToDatabase();
  const articles = await Article.find({ status: "published" })
    .sort({ publishedAt: -1 })
    .limit(limit)
    .populate("authorId", "name")
    .populate("categoryIds", "name slug")
    .lean() as unknown as Record<string, unknown>[];
  return articles.map(toPublicArticle);
}

export async function getCategorySection(categorySlug: string, limit = 6): Promise<{ category: PublicCategory | null; articles: PublicArticle[] }> {
  await connectToDatabase();
  const category = await Category.findOne({ slug: categorySlug, visible: true }).lean() as unknown as Record<string, unknown> | null;
  if (!category) return { category: null, articles: [] };
  const articles = await Article.find({ status: "published", categoryIds: category._id })
    .sort({ publishedAt: -1 })
    .limit(limit)
    .populate("authorId", "name")
    .populate("categoryIds", "name slug")
    .lean() as unknown as Record<string, unknown>[];
  return {
    category: { id: String(category._id), name: String(category.name), slug: String(category.slug), description: category.description ? String(category.description) : null },
    articles: articles.map(toPublicArticle),
  };
}

export async function getArticleBySlug(slug: string): Promise<PublicArticle | null> {
  const cacheKey = "cache:public:article:" + slug;
  const cached = await cacheGet<PublicArticle>(cacheKey);
  if (cached) return cached;
  await connectToDatabase();
  const article = await Article.findOne({ slug, status: "published" })
    .populate("authorId", "name")
    .populate("categoryIds", "name slug")
    .populate("tagIds", "name slug")
    .lean() as unknown as Record<string, unknown> | null;
  if (!article) return null;
  const result = toPublicArticle(article);
  await cacheSet(cacheKey, result, 300);
  return result;
}

/** Fetch multiple published articles by their IDs (used for sponsored pin-to-top). */
export async function getArticlesByIds(ids: string[]): Promise<PublicArticle[]> {
  if (ids.length === 0) return [];
  await connectToDatabase();
  const articles = await Article.find({ _id: { $in: ids }, status: "published" })
    .populate("authorId", "name")
    .populate("categoryIds", "name slug")
    .populate("tagIds", "name slug")
    .lean() as unknown as Record<string, unknown>[];
  return articles.map(toPublicArticle);
}

export async function getRelatedArticles(articleId: string, categoryIds: string[], limit = 5): Promise<PublicArticle[]> {
  await connectToDatabase();
  const articles = await Article.find({
    status: "published",
    _id: { $ne: articleId },
    categoryIds: { $in: categoryIds },
  })
    .sort({ publishedAt: -1 })
    .limit(limit)
    .populate("authorId", "name")
    .populate("categoryIds", "name slug")
    .lean() as unknown as Record<string, unknown>[];
  return articles.map(toPublicArticle);
}

export async function getCategoryArticles(slug: string, page = 1, limit = 20): Promise<{ category: PublicCategory | null; articles: PublicArticle[]; total: number; totalPages: number; page: number }> {
  await connectToDatabase();
  const category = await Category.findOne({ slug, visible: true }).lean() as unknown as Record<string, unknown> | null;
  if (!category) return { category: null, articles: [], total: 0, totalPages: 0, page };
  const skip = (page - 1) * limit;
  const [articles, total] = await Promise.all([
    Article.find({ status: "published", categoryIds: category._id })
      .sort({ publishedAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("authorId", "name")
      .populate("categoryIds", "name slug")
      .lean() as unknown as Record<string, unknown>[],
    Article.countDocuments({ status: "published", categoryIds: category._id }),
  ]);
  return {
    category: { id: String(category._id), name: String(category.name), slug: String(category.slug), description: category.description ? String(category.description) : null },
    articles: articles.map(toPublicArticle),
    total,
    totalPages: Math.ceil(total / limit),
    page,
  };
}

export async function searchArticles(query: string, page = 1, limit = 20): Promise<{ articles: PublicArticle[]; total: number; totalPages: number; page: number }> {
  await connectToDatabase();
  if (!query.trim()) return { articles: [], total: 0, totalPages: 0, page };
  const filter = {
    status: "published",
    $or: [
      { title: { $regex: query, $options: "i" } },
      { excerpt: { $regex: query, $options: "i" } },
      { content: { $regex: query, $options: "i" } },
    ],
  };
  const skip = (page - 1) * limit;
  const [articles, total] = await Promise.all([
    Article.find(filter).sort({ publishedAt: -1 }).skip(skip).limit(limit)
      .populate("authorId", "name").populate("categoryIds", "name slug")
      .lean() as unknown as Record<string, unknown>[],
    Article.countDocuments(filter),
  ]);
  return { articles: articles.map(toPublicArticle), total, totalPages: Math.ceil(total / limit), page };
}

export async function getTagArticles(slug: string, page = 1, limit = 20): Promise<{ tag: { id: string; name: string; slug: string } | null; articles: PublicArticle[]; total: number; totalPages: number; page: number }> {
  await connectToDatabase();
  const tag = await Tag.findOne({ slug }).lean() as unknown as Record<string, unknown> | null;
  if (!tag) return { tag: null, articles: [], total: 0, totalPages: 0, page };
  const skip = (page - 1) * limit;
  const [articles, total] = await Promise.all([
    Article.find({ status: "published", tagIds: tag._id }).sort({ publishedAt: -1 }).skip(skip).limit(limit)
      .populate("authorId", "name").populate("categoryIds", "name slug")
      .lean() as unknown as Record<string, unknown>[],
    Article.countDocuments({ status: "published", tagIds: tag._id }),
  ]);
  return {
    tag: { id: String(tag._id), name: String(tag.name), slug: String(tag.slug) },
    articles: articles.map(toPublicArticle),
    total,
    totalPages: Math.ceil(total / limit),
    page,
  };
}

export async function getNextArticle(articleId: string, categoryIds: string[]): Promise<PublicArticle | null> {
  await connectToDatabase();
  const article = await Article.findById(articleId).lean() as unknown as Record<string, unknown> | null;
  if (!article) return null;
  const publishedAt = article.publishedAt as string | Date;
  const nextArticle = await Article.findOne({
    status: "published",
    _id: { $ne: articleId },
    categoryIds: { $in: categoryIds },
    publishedAt: { $lt: new Date(publishedAt) },
  })
    .sort({ publishedAt: -1 })
    .populate("authorId", "name")
    .populate("categoryIds", "name slug")
    .populate("tagIds", "name slug")
    .lean() as unknown as Record<string, unknown> | null;
  return nextArticle ? toPublicArticle(nextArticle) : null;
}

export async function getPreviousArticle(articleId: string, categoryIds: string[]): Promise<PublicArticle | null> {
  await connectToDatabase();
  const article = await Article.findById(articleId).lean() as unknown as Record<string, unknown> | null;
  if (!article) return null;
  const publishedAt = article.publishedAt as string | Date;
  const prevArticle = await Article.findOne({
    status: "published",
    _id: { $ne: articleId },
    categoryIds: { $in: categoryIds },
    publishedAt: { $gt: new Date(publishedAt) },
  })
    .sort({ publishedAt: 1 })
    .populate("authorId", "name")
    .populate("categoryIds", "name slug")
    .populate("tagIds", "name slug")
    .lean() as unknown as Record<string, unknown> | null;
  return prevArticle ? toPublicArticle(prevArticle) : null;
}

export async function getTrendingArticles(limit = 10): Promise<PublicArticle[]> {
  await connectToDatabase();
  // Trending = most recently published with featured images, fallback to latest
  const articles = await Article.find({ status: "published", "featuredImage.url": { $exists: true } })
    .sort({ publishedAt: -1 })
    .limit(limit)
    .populate("authorId", "name")
    .populate("categoryIds", "name slug")
    .lean() as unknown as Record<string, unknown>[];
  return articles.map(toPublicArticle);
}

export async function getLatestByCategory(limit = 8): Promise<{ category: PublicCategory; article: PublicArticle }[]> {
  await connectToDatabase();
  const categories = await Category.find({ visible: true }).sort({ order: 1, name: 1 }).lean() as unknown as Record<string, unknown>[];
  const items: { category: PublicCategory; article: PublicArticle }[] = [];
  for (const cat of categories.slice(0, limit)) {
    const article = await Article.findOne({ status: "published", categoryIds: cat._id })
      .sort({ publishedAt: -1 })
      .populate("authorId", "name")
      .populate("categoryIds", "name slug")
      .lean() as unknown as Record<string, unknown> | null;
    if (article) {
      items.push({
        category: { id: String(cat._id), name: String(cat.name), slug: String(cat.slug), description: cat.description ? String(cat.description) : null },
        article: toPublicArticle(article),
      });
    }
  }
  return items;
}

export async function getSpecialArticles(slug = "jjd-special", limit = 6): Promise<{ label: string; articles: PublicArticle[] }> {
  await connectToDatabase();
  const category = await Category.findOne({ slug, visible: true }).lean() as unknown as Record<string, unknown> | null;
  if (category) {
    const articles = await Article.find({ status: "published", categoryIds: category._id })
      .sort({ publishedAt: -1 })
      .limit(limit)
      .populate("authorId", "name")
      .populate("categoryIds", "name slug")
      .lean() as unknown as Record<string, unknown>[];
    return { label: String(category.name), articles: articles.map(toPublicArticle) };
  }
  const tag = await Tag.findOne({ slug }).lean() as unknown as Record<string, unknown> | null;
  if (tag) {
    const articles = await Article.find({ status: "published", tagIds: tag._id })
      .sort({ publishedAt: -1 })
      .limit(limit)
      .populate("authorId", "name")
      .populate("categoryIds", "name slug")
      .lean() as unknown as Record<string, unknown>[];
    return { label: String(tag.name), articles: articles.map(toPublicArticle) };
  }
  const articles = await Article.find({ status: "published" })
    .sort({ publishedAt: -1 })
    .limit(limit)
    .populate("authorId", "name")
    .populate("categoryIds", "name slug")
    .lean() as unknown as Record<string, unknown>[];
  return { label: "JJD Special", articles: articles.map(toPublicArticle) };
}

export async function createSubscriberPublic(email: string, sourcePath: string): Promise<{ success: boolean; error?: string }> {
  await connectToDatabase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { success: false, error: "Please enter a valid email address." };
  }
  const existing = await Subscriber.findOne({ email: email.trim().toLowerCase() });
  if (existing) {
    if (existing.status === "subscribed") return { success: false, error: "You are already subscribed." };
    existing.status = "subscribed";
    existing.consentedAt = new Date();
    await existing.save();
    return { success: true };
  }
  await Subscriber.create({
    email: email.trim().toLowerCase(),
    status: "subscribed",
    consentedAt: new Date(),
    sourcePath,
    unsubscribeToken: crypto.randomBytes(32).toString("hex"),
  });
  return { success: true };
}


// --- Advertising (public ad resolution) -----------------------------------

export type PublicAd = {
  id: string;
  name: string;
  slot: string;
  size: string;
  type: string;
  mediaUrl: string;
  clickUrl: string;
  rawTag: string;
  youtubeUrl: string;
  youtubeId: string;
  vastUrl: string;
  impressionPixelUrl: string;
  clickTrackingUrl: string;
  scope: string;
  categorySlug: string;
  device: string;
};

export type PublicSponsored = {
  id: string;
  type: string;
  categorySlug: string;
  articleId: string | null;
  title: string;
  imageUrl: string;
  clickUrl: string;
  description: string;
  label: string;
};

function toPublicAd(a: Record<string, unknown>): PublicAd {
  return {
    id: String(a._id),
    name: String(a.name || ""),
    slot: String(a.slot || ""),
    size: String(a.size || ""),
    type: String(a.type || ""),
    mediaUrl: String(a.mediaUrl || ""),
    clickUrl: String(a.clickUrl || ""),
    rawTag: String(a.rawTag || ""),
    youtubeUrl: String(a.youtubeUrl || ""),
    youtubeId: String(a.youtubeId || ""),
    vastUrl: String(a.vastUrl || ""),
    impressionPixelUrl: String(a.impressionPixelUrl || ""),
    clickTrackingUrl: String(a.clickTrackingUrl || ""),
    scope: String(a.scope || "all"),
    categorySlug: String(a.categorySlug || ""),
    device: String(a.device || "all"),
  };
}

/**
 * Detect device type from a User-Agent string.
 * Returns "mobile" for phones/tablets, "desktop" for everything else.
 */
export function detectDevice(userAgent: string | null | undefined): "desktop" | "mobile" {
  if (!userAgent) return "desktop";
  const ua = userAgent.toLowerCase();
  // Tablets (iPad, Android tablets) and phones are both "mobile" for ad targeting
  if (/mobile|android|iphone|ipod|ipad|tablet|kindle|silk|blackberry|opera mini|windows phone/i.test(ua)) {
    return "mobile";
  }
  return "desktop";
}

function toPublicSponsored(s: Record<string, unknown>): PublicSponsored {
  return {
    id: String(s._id),
    type: String(s.type || "ad_card"),
    categorySlug: String(s.categorySlug || ""),
    articleId: s.articleId ? String((s.articleId as Record<string, unknown>)._id ?? s.articleId) : null,
    title: String(s.title || ""),
    imageUrl: String(s.imageUrl || ""),
    clickUrl: String(s.clickUrl || ""),
    description: String(s.description || ""),
    label: String(s.label || "Sponsored"),
  };
}

/**
 * Replace cache-busting macros in a tag/pixel URL with a random value.
 * Supports: [timestamp], [CACHEBUSTER], ord=[timestamp]
 */
export function replaceCacheBusting(input: string): string {
  const random = Date.now() + Math.floor(Math.random() * 1_000_000);
  return input
    .replaceAll("[timestamp]", String(random))
    .replaceAll("[CACHEBUSTER]", String(random))
    .replaceAll("ord=[timestamp]", "ord=" + random);
}

/**
 * Check if an ad is currently active (within date range if dates are set).
 */
function isAdLive(a: Record<string, unknown>): boolean {
  if (!a.active) return false;
  const now = new Date();
  if (a.startDate && new Date(a.startDate as string) > now) return false;
  if (a.endDate && new Date(a.endDate as string) < now) return false;
  return true;
}

/**
 * Resolve the winning ad for a given slot + context.
 * Priority: category-specific > page-specific > ALL fallback.
 * Device filter: "all" matches any device; "desktop"/"mobile" must match.
 * Among matches at the same level, highest priority field wins.
 */
export async function resolveAdForSlot(
  slot: string,
  context: { page?: string; categorySlug?: string; device?: "desktop" | "mobile" } = {}
): Promise<PublicAd | null> {
  const device = context.device || "desktop";
  const cacheKey = `cache:public:ad:${slot}:${context.page || ""}:${context.categorySlug || ""}:${device}`;
  const cached = await cacheGet<PublicAd | null>(cacheKey);
  if (cached !== null && cached !== undefined) return cached;

  await connectToDatabase();
  const candidates = await Advertisement.find({ slot, active: true }).lean() as Array<Record<string, unknown>>;

  // Filter by scheduling + device
  const live = candidates.filter((a) => {
    if (!isAdLive(a)) return false;
    const adDevice = String(a.device || "all");
    // "all" matches any device; otherwise must match exactly
    if (adDevice !== "all" && adDevice !== device) return false;
    return true;
  });
  if (live.length === 0) {
    await cacheSet(cacheKey, null, 60);
    return null;
  }

  // Priority tiers: 1 = category-specific, 2 = page-specific, 3 = ALL
  const tier = (a: Record<string, unknown>): number => {
    const scope = String(a.scope);
    if (scope === "category" && a.categorySlug && context.categorySlug && String(a.categorySlug) === context.categorySlug) return 1;
    if (scope === "article" && context.page === "article") {
      if (a.categorySlug && context.categorySlug && String(a.categorySlug) === context.categorySlug) return 1;
      if (!a.categorySlug) return 2;
    }
    if (scope === "homepage" && context.page === "homepage") return 2;
    if (scope === "all") return 3;
    return 99; // no match
  };

  const ranked = live
    .map((a) => ({ ad: a, tier: tier(a), priority: Number(a.priority ?? 0) }))
    .filter((x) => x.tier < 99)
    .sort((a, b) => a.tier - b.tier || b.priority - a.priority);

  const winner = ranked[0]?.ad;
  const result = winner ? toPublicAd(winner) : null;
  await cacheSet(cacheKey, result, 60);
  return result;
}

/**
 * Batch-resolve ads for multiple slots (e.g., homepage has many slots).
 * Returns a map of slot -> PublicAd | null.
 */
export async function resolveAdsForSlots(
  slots: string[],
  context: { page?: string; categorySlug?: string; device?: "desktop" | "mobile" } = {}
): Promise<Record<string, PublicAd | null>> {
  const entries = await Promise.all(
    slots.map(async (slot) => [slot, await resolveAdForSlot(slot, context)] as const)
  );
  return Object.fromEntries(entries);
}

/**
 * Fetch the interstitial ad (web or mobile based on isMobile flag).
 */
export async function getInterstitialAd(isMobile: boolean): Promise<PublicAd | null> {
  return resolveAdForSlot(isMobile ? "interstitial_mobile" : "interstitial_web", { page: "all", device: isMobile ? "mobile" : "desktop" });
}

/**
 * Fetch sponsored content pinned to a category.
 * Returns active sponsored items sorted by priority (desc).
 */
export async function getSponsoredForCategory(categorySlug: string): Promise<PublicSponsored[]> {
  const cacheKey = `cache:public:sponsored:${categorySlug}`;
  const cached = await cacheGet<PublicSponsored[]>(cacheKey);
  if (cached) return cached;

  await connectToDatabase();
  const items = await SponsoredContent.find({ categorySlug, active: true })
    .sort({ priority: -1, createdAt: -1 })
    .populate("articleId")
    .lean() as Array<Record<string, unknown>>;

  const result = items.map(toPublicSponsored);
  await cacheSet(cacheKey, result, 60);
  return result;
}

/**
 * Fetch VAST XML from a VAST URL and extract the first media file URL.
 * This is a "VAST-lite" approach — it does not support VPAID or tracking events.
 */
export async function resolveVastMediaUrl(vastUrl: string): Promise<string | null> {
  try {
    const res = await fetch(vastUrl, { headers: { "User-Agent": "BehindTheHeadlines/1.0" } });
    if (!res.ok) return null;
    const xml = await res.text();
    // Extract the first <MediaFile> CDATA or text content
    const match = xml.match(/<MediaFile[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/MediaFile>/i);
    if (!match) return null;
    const url = match[1].trim();
    // Basic validation — must be a URL
    try { new URL(url); } catch { return null; }
    return url;
  } catch {
    return null;
  }
}
