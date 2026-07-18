/**
 * RSS Background Worker
 *
 * This is a standalone Node.js process that runs alongside the Next.js web app.
 * It continuously checks for due RSS sources, enqueues import jobs, and processes
 * them from the Redis queue with retries and crash recovery.
 *
 * Run with: npm run worker
 * In production: node dist/worker.js (after build)
 */

import mongoose from "mongoose";
import Redis from "ioredis";
import { XMLParser } from "fast-xml-parser";
import crypto from "crypto";
import sharp from "sharp";
import sanitizeHtml from "sanitize-html";
import { stripLeadingImages, stripAgencyArtifacts } from "../lib/content-helpers";

// --- Types ----------------------------------------------------------------

type RssSourceDoc = {
  _id: mongoose.Types.ObjectId;
  name: string;
  feedUrl: string;
  categoryId: mongoose.Types.ObjectId;
  intervalMinutes: number;
  active: boolean;
  nextRunAt: Date | null;
  lastRunAt: Date | null;
  lastError: string | null;
  lastImportedCount: number;
};

type RssJob = {
  sourceId: string;
  sourceName: string;
  feedUrl: string;
  attempt: number;
  enqueuedAt: number;
};

type FeedItem = {
  title: string;
  link: string;
  guid: string;
  publishedAt: string;
  summary: string;
  content: string;
  imageUrl: string | null;
};

// --- Config ---------------------------------------------------------------

const MONGODB_URI = process.env.MONGODB_URI;
const REDIS_URL = process.env.REDIS_URL;
const RUSTFS_ENDPOINT = process.env.RUSTFS_ENDPOINT;
const RUSTFS_ACCESS_KEY = process.env.RUSTFS_ACCESS_KEY;
const RUSTFS_SECRET_KEY = process.env.RUSTFS_SECRET_KEY;
const RUSTFS_BUCKET = process.env.RUSTFS_BUCKET || "behind-the-headlines-media";
const RUSTFS_PUBLIC_URL = process.env.RUSTFS_PUBLIC_URL || RUSTFS_ENDPOINT;
const RUSTFS_REGION = process.env.RUSTFS_REGION || "us-east-1";

const POLL_INTERVAL_MS = 30_000; // Check for due sources every 30 seconds
const JOB_TIMEOUT_MS = 120_000; // 2 minute timeout per job
const MAX_ATTEMPTS = 3;
const BATCH_SIZE = 25; // Max items to import per feed

const QUEUE_KEY = "rss:queue";
const PROCESSING_KEY = "rss:processing";
const LOCK_PREFIX = "rss:lock:";
const HEARTBEAT_KEY = "rss:worker:heartbeat";

// --- Utilities ------------------------------------------------------------

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", trimValues: true });

function log(message: string, level: "info" | "warn" | "error" = "info") {
  const timestamp = new Date().toISOString();
  const prefix = level === "error" ? "[ERROR]" : level === "warn" ? "[WARN] " : "[INFO] ";
  console.log(`${prefix} ${timestamp} ${message}`);
}

function slugify(text: string): string {
  return text.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 80);
}

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

// --- HTML Sanitization ----------------------------------------------------

const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "p", "br", "hr", "strong", "b", "em", "i", "u", "s", "del", "ins", "mark", "small", "sub", "sup",
    "h1", "h2", "h3", "h4", "h5", "h6",
    "ul", "ol", "li",
    "a", "img",
    "blockquote", "q", "cite", "code", "pre", "kbd", "samp",
    "table", "thead", "tbody", "tfoot", "tr", "th", "td",
    "figure", "figcaption", "abbr", "address", "time", "details", "summary",
    "div", "span",
  ],
  allowedAttributes: {
    a: ["href", "title", "target", "rel"],
    img: ["src", "alt", "title", "width", "height", "loading"],
    table: ["class"],
    th: ["scope", "colspan", "rowspan"],
    td: ["colspan", "rowspan"],
    time: ["datetime"],
    abbr: ["title"],
    "*": ["class"],
  },
  allowedSchemes: ["http", "https", "mailto"],
  allowProtocolRelative: false,
  transformTags: {
    a: (tagName, attribs) => {
      const href = attribs.href || "";
      if (href.startsWith("http://") || href.startsWith("https://")) {
        return { tagName, attribs: { ...attribs, target: "_blank", rel: "noopener noreferrer nofollow" } };
      }
      return { tagName, attribs };
    },
    img: (tagName, attribs) => ({ tagName, attribs: { ...attribs, loading: "lazy" } }),
  },
  allowedStyles: {},
};

function sanitizeRssContent(html: string): string {
  if (!html) return "";
  return sanitizeHtml(html, SANITIZE_OPTIONS);
}

function htmlToExcerpt(html: string, maxLength = 300): string {
  if (!html) return "";
  const text = sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} }).trim();
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).replace(/\s+\S*$/, "") + "…";
}


// --- Image Optimization ---------------------------------------------------

const RESPONSIVE_WIDTHS = [480, 768, 1024, 1920];

type ImageVariant = { width: number; format: "webp" | "avif"; key: string; url: string; size: number };

async function generateImageVariants(
  originalKey: string,
  buffer: Buffer,
  contentType: string,
): Promise<{ variants: ImageVariant[]; width: number; height: number }> {
  const metadata = await sharp(buffer).metadata();
  const originalWidth = metadata.width || 0;
  const originalHeight = metadata.height || 0;
  const baseKey = originalKey.replace(/\.[^.]+$/, "");
  const variants: ImageVariant[] = [];

  for (const width of RESPONSIVE_WIDTHS) {
    if (width >= originalWidth) continue;
    for (const format of ["webp", "avif"] as const) {
      try {
        const variantBuffer = await sharp(buffer)
          .resize({ width, withoutEnlargement: true })
          .toFormat(format, { quality: format === "avif" ? 50 : 80 })
          .toBuffer();
        const variantKey = `${baseKey}-${width}w.${format}`;
        const { PutObjectCommand } = await import("@aws-sdk/client-s3");
        const s3 = await getS3Client();
        if (!s3) continue;
        await s3.send(new PutObjectCommand({ Bucket: RUSTFS_BUCKET, Key: variantKey, Body: variantBuffer, ContentType: `image/${format}` }));
        const publicUrl = `${RUSTFS_PUBLIC_URL}/${RUSTFS_BUCKET}/${variantKey}`;
        variants.push({ width, format, key: variantKey, url: publicUrl, size: variantBuffer.length });
      } catch { /* skip */ }
    }
  }

  // WebP at original width
  if (originalWidth > 0) {
    try {
      const webpOriginal = await sharp(buffer).toFormat("webp", { quality: 80 }).toBuffer();
      const webpKey = `${baseKey}-${originalWidth}w.webp`;
      const { PutObjectCommand } = await import("@aws-sdk/client-s3");
      const s3 = await getS3Client();
      if (s3) {
        await s3.send(new PutObjectCommand({ Bucket: RUSTFS_BUCKET, Key: webpKey, Body: webpOriginal, ContentType: "image/webp" }));
        const publicUrl = `${RUSTFS_PUBLIC_URL}/${RUSTFS_BUCKET}/${webpKey}`;
        variants.push({ width: originalWidth, format: "webp", key: webpKey, url: publicUrl, size: webpOriginal.length });
      }
    } catch { /* skip */ }
  }

  return { variants, width: originalWidth, height: originalHeight };
}

function text(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "#text" in value) return String((value as Record<string, unknown>)["#text"]);
  return "";
}

const privateHost = (hostname: string) =>
  hostname === "localhost" ||
  hostname.endsWith(".local") ||
  /^127\.|^10\.|^192\.168\.|^169\.254\.|^0\./.test(hostname) ||
  /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname) ||
  hostname === "::1";

// --- Connections ----------------------------------------------------------

let redis: Redis;
let mongoConn: typeof mongoose;

async function connectRedis(): Promise<Redis> {
  if (!REDIS_URL) throw new Error("REDIS_URL is not set");
  redis = new Redis(REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    connectTimeout: 10_000,
    retryStrategy: (times) => Math.min(times * 1000, 5000),
  });
  redis.on("error", (err) => log(`Redis error: ${err.message}`, "error"));
  redis.on("connect", () => log("Redis connected"));
  await redis.ping();
  return redis;
}

async function connectMongo(): Promise<typeof mongoose> {
  if (!MONGODB_URI) throw new Error("MONGODB_URI is not set");
  mongoConn = await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 10_000 });
  log(`MongoDB connected: ${mongoConn.connection.name}`);
  return mongoConn;
}

// --- S3 / RustFS ----------------------------------------------------------

let s3Client: import("@aws-sdk/client-s3").S3Client | null = null;

async function getS3Client() {
  if (!RUSTFS_ENDPOINT || !RUSTFS_ACCESS_KEY || !RUSTFS_SECRET_KEY) return null;
  if (!s3Client) {
    const { S3Client } = await import("@aws-sdk/client-s3");
    s3Client = new S3Client({
      endpoint: RUSTFS_ENDPOINT,
      region: RUSTFS_REGION,
      credentials: { accessKeyId: RUSTFS_ACCESS_KEY, secretAccessKey: RUSTFS_SECRET_KEY },
      forcePathStyle: true,
    });
  }
  return s3Client;
}

async function downloadImage(imageUrl: string, altText: string, uploadedById: mongoose.Types.ObjectId): Promise<{ key: string; url: string; variants: ImageVariant[]; width: number; height: number } | null> {
  try {
    const s3 = await getS3Client();
    if (!s3) return null;

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

    const { PutObjectCommand } = await import("@aws-sdk/client-s3");
    await s3.send(new PutObjectCommand({
      Bucket: RUSTFS_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    }));

    const publicUrl = `${RUSTFS_PUBLIC_URL}/${RUSTFS_BUCKET}/${key}`;

    // Generate optimized variants
    let variants: ImageVariant[] = [];
    let imgWidth = 0;
    let imgHeight = 0;
    try {
      const optimized = await generateImageVariants(key, buffer, contentType);
      variants = optimized.variants;
      imgWidth = optimized.width;
      imgHeight = optimized.height;
    } catch { /* best-effort */ }

    // Create a Media record so it appears in the media library
    const Media = mongoose.model("Media");
    const filename = imageUrl.split("/").pop()?.split("?")[0] || `rss-image.${ext}`;
    await Media.create({
      key,
      url: publicUrl,
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

    return { key, url: publicUrl, variants, width: imgWidth, height: imgHeight };
  } catch {
    return null;
  }
}

// --- Feed fetching --------------------------------------------------------

async function fetchFeed(feedUrl: string): Promise<{ title: string; items: FeedItem[] }> {
  const url = new URL(feedUrl);
  if (!/^https?:$/.test(url.protocol) || privateHost(url.hostname)) {
    throw new Error("Invalid feed URL");
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
  const items = (Array.isArray(rawItems) ? rawItems : [rawItems]).slice(0, BATCH_SIZE).map((item: Record<string, unknown>) => {
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

// --- Import logic ---------------------------------------------------------

async function findDuplicate(guid: string, link: string, title: string, content: string): Promise<boolean> {
  const Article = mongoose.model("Article");
  if (guid) {
    const byGuid = await Article.findOne({ rssGuid: guid }).lean();
    if (byGuid) return true;
  }
  if (link) {
    const byUrl = await Article.findOne({ sourceUrl: link }).lean();
    if (byUrl) return true;
  }
  const hash = contentHash(title, content);
  const byHash = await Article.findOne({ contentHash: hash }).lean();
  if (byHash) return true;
  return false;
}

async function processJob(job: RssJob): Promise<{ imported: number; skipped: number }> {
  const Article = mongoose.model("Article");
  const RssSource = mongoose.model("RssSource");
  const RssImport = mongoose.model("RssImport");
  const User = mongoose.model("User");

  const source = await RssSource.findById(job.sourceId);
  if (!source) throw new Error(`Source ${job.sourceId} not found`);
  if (!source.active) {
    log(`Source ${source.name} is inactive, skipping`);
    return { imported: 0, skipped: 0 };
  }

  const { items } = await fetchFeed(source.feedUrl);

  // Find or create system user
  let systemUser = await User.findOne({ email: "rss-system@behind-the-headlines.local" });
  if (!systemUser) {
    systemUser = await User.create({
      name: "RSS System",
      email: "rss-system@behind-the-headlines.local",
      passwordHash: crypto.randomBytes(32).toString("hex"),
      role: "editor",
      active: false,
    });
  }

  let imported = 0;
  let skipped = 0;

  for (const item of items) {
    const exists = await findDuplicate(item.guid, item.link, item.title, item.content);
    if (exists) {
      skipped++;
      continue;
    }

    // Sanitize HTML content, strip leading image and agency artifacts
    const sanitizedContent = stripAgencyArtifacts(stripLeadingImages(sanitizeRssContent(item.content)));
    const sanitizedSummary = htmlToExcerpt(sanitizedContent, 300);

    // Download image and generate optimized variants
    let featuredImage: { url: string; alt: string; width: number; height: number; variants: ImageVariant[] } | undefined;
    if (item.imageUrl) {
      const downloaded = await downloadImage(item.imageUrl, item.title, systemUser._id);
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

    await Article.create({
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

    imported++;
  }

  // Update source metadata
  source.lastRunAt = new Date();
  source.nextRunAt = new Date(Date.now() + source.intervalMinutes * 60 * 1000);
  source.lastError = null;
  source.lastImportedCount = imported;
  await source.save();

  // Record import
  await RssImport.create({
    sourceId: source._id,
    status: imported > 0 ? "success" : "partial",
    importedCount: imported,
    skippedCount: skipped,
    articleIds: [],
  });

  // Invalidate article cache
  try {
    const keys = await redis.keys("cache:articles:*");
    if (keys.length > 0) await redis.del(...keys);
    const articleKeys = await redis.keys("cache:article:*");
    if (articleKeys.length > 0) await redis.del(...articleKeys);
  } catch { /* ignore cache errors */ }

  log(`Imported ${imported} new, skipped ${skipped} duplicates from ${source.name}`);
  return { imported, skipped };
}

// --- Queue operations -----------------------------------------------------

async function enqueueDueSources(): Promise<number> {
  const RssSource = mongoose.model("RssSource");
  const now = new Date();
  const dueSources = await RssSource.find({
    active: true,
    $or: [
      { nextRunAt: { $lte: now } },
      { nextRunAt: null },
    ],
  }) as unknown as RssSourceDoc[];

  let enqueued = 0;
  for (const source of dueSources) {
    // Check if already in queue
    const existing = await redis.lrange(QUEUE_KEY, 0, -1);
    const alreadyQueued = existing.some((jobStr) => {
      try {
        const job = JSON.parse(jobStr) as RssJob;
        return job.sourceId === String(source._id);
      } catch { return false; }
    });

    if (alreadyQueued) continue;

    // Check lock
    const lockKey = LOCK_PREFIX + String(source._id);
    const locked = await redis.get(lockKey);
    if (locked) continue;

    const job: RssJob = {
      sourceId: String(source._id),
      sourceName: source.name,
      feedUrl: source.feedUrl,
      attempt: 1,
      enqueuedAt: Date.now(),
    };
    await redis.rpush(QUEUE_KEY, JSON.stringify(job));
    enqueued++;
    log(`Enqueued job for ${source.name} (next run was ${source.nextRunAt?.toISOString() || "never"})`);
  }

  return enqueued;
}

async function promoteDelayedJobs(): Promise<number> {
  const now = Date.now();
  const ready = await redis.zrangebyscore("rss:delayed", 0, now);
  if (ready.length === 0) return 0;

  for (const jobStr of ready) {
    await redis.rpush(QUEUE_KEY, jobStr);
    await redis.zrem("rss:delayed", jobStr);
  }
  log(`Promoted ${ready.length} delayed job(s) back to queue`);
  return ready.length;
}

async function recoverStaleJobs(): Promise<number> {
  const stale = await redis.lrange(PROCESSING_KEY, 0, -1);
  if (stale.length === 0) return 0;

  for (const jobStr of stale) {
    await redis.rpush(QUEUE_KEY, jobStr);
    await redis.lrem(PROCESSING_KEY, 0, jobStr);
  }
  log(`Recovered ${stale.length} stale job(s) from previous run`, "warn");
  return stale.length;
}

async function processNextJob(): Promise<boolean> {
  // Move from queue to processing
  const jobStr = await redis.lmove(QUEUE_KEY, PROCESSING_KEY, "LEFT", "RIGHT");
  if (!jobStr) return false;

  const job = JSON.parse(jobStr) as RssJob;
  const lockKey = LOCK_PREFIX + job.sourceId;

  // Acquire lock
  const lockAcquired = await redis.set(lockKey, "locked", "EX", 300, "NX");
  if (lockAcquired !== "OK") {
    // Another worker has the lock, put job back
    await redis.lrem(PROCESSING_KEY, 0, jobStr);
    await redis.rpush(QUEUE_KEY, jobStr);
    return false;
  }

  log(`Processing job: ${job.sourceName} (attempt ${job.attempt}/${MAX_ATTEMPTS})`);

  try {
    // Set a timeout for the job
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Job timeout")), JOB_TIMEOUT_MS),
    );

    await Promise.race([processJob(job), timeoutPromise]);

    // Acknowledge success — remove from processing
    await redis.lrem(PROCESSING_KEY, 0, jobStr);
    await redis.del(lockKey);
    return true;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    log(`Job failed for ${job.sourceName}: ${errorMsg}`, "error");

    // Remove from processing
    await redis.lrem(PROCESSING_KEY, 0, jobStr);
    await redis.del(lockKey);

    // Update source error
    try {
      const RssSource = mongoose.model("RssSource");
      await RssSource.findByIdAndUpdate(job.sourceId, {
        lastError: errorMsg,
        lastRunAt: new Date(),
        nextRunAt: new Date(Date.now() + 60 * 60 * 1000), // retry in 1 hour
      });
    } catch { /* ignore */ }

    // Retry with backoff if attempts remaining
    if (job.attempt < MAX_ATTEMPTS) {
      const delaySeconds = 30 * Math.pow(2, job.attempt - 1);
      const requeued: RssJob = {
        ...job,
        attempt: job.attempt + 1,
        enqueuedAt: Date.now(),
      };
      await redis.zadd("rss:delayed", Date.now() + delaySeconds * 1000, JSON.stringify(requeued));
      log(`Re-enqueued ${job.sourceName} with ${delaySeconds}s delay (attempt ${job.attempt + 1})`, "warn");
    } else {
      log(`Giving up on ${job.sourceName} after ${MAX_ATTEMPTS} attempts`, "error");

      // Record failure
      try {
        const RssImport = mongoose.model("RssImport");
        await RssImport.create({
          sourceId: job.sourceId,
          status: "failed",
          importedCount: 0,
          skippedCount: 0,
          error: errorMsg,
        });
      } catch { /* ignore */ }
    }

    return true; // job was processed (even though it failed)
  }
}

async function sendHeartbeat(stats: { processed: number; failed: number; sourceId?: string }): Promise<void> {
  const data = { timestamp: Date.now(), ...stats };
  await redis.set(HEARTBEAT_KEY, JSON.stringify(data), "EX", 120);
}

// --- Main loop ------------------------------------------------------------

let processed = 0;
let failed = 0;
let running = true;

async function mainLoop(): Promise<void> {
  log("Worker main loop started");

  while (running) {
    try {
      // 1. Promote delayed jobs
      await promoteDelayedJobs();

      // 2. Enqueue due sources
      const enqueued = await enqueueDueSources();
      if (enqueued > 0) {
        log(`Enqueued ${enqueued} new job(s)`);
      }

      // 3. Process available jobs
      let hadJobs = false;
      for (let i = 0; i < 10; i++) {
        const didProcess = await processNextJob();
        if (didProcess) {
          hadJobs = true;
          processed++;
        } else {
          break;
        }
      }

      // 4. Send heartbeat
      await sendHeartbeat({ processed, failed });

      // 5. Wait before next poll
      if (!hadJobs) {
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      log(`Main loop error: ${msg}`, "error");
      failed++;
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }
  }
}

// --- Startup --------------------------------------------------------------

async function start(): Promise<void> {
  log("=== RSS Background Worker starting ===");
  log(`Poll interval: ${POLL_INTERVAL_MS / 1000}s`);
  log(`Max attempts: ${MAX_ATTEMPTS}`);
  log(`Job timeout: ${JOB_TIMEOUT_MS / 1000}s`);

  // Connect to services
  await connectRedis();
  await connectMongo();

  // Define models (same as the web app)
  const { Schema, model, models } = mongoose;
  const timestamps = { timestamps: true };
  const imageSchema = new Schema({ url: { type: String, required: true }, alt: { type: String, default: "" }, caption: { type: String, default: "" }, credit: { type: String, default: "" } }, { _id: false });

  if (!models.User) model("User", new Schema({
    name: { type: String, required: true }, email: { type: String, required: true, unique: true, lowercase: true },
    passwordHash: { type: String, required: true }, role: { type: String, enum: ["admin", "editor"], default: "editor" }, active: { type: Boolean, default: true },
  }, timestamps));

  if (!models.Category) model("Category", new Schema({ name: { type: String, required: true }, slug: { type: String, required: true, unique: true }, description: String, parentId: Schema.Types.ObjectId, visible: { type: Boolean, default: true }, order: { type: Number, default: 0 } }, timestamps));

  if (!models.Article) {
    const articleSchema = new Schema({
      title: { type: String, required: true }, slug: { type: String, required: true, unique: true }, excerpt: { type: String, default: "" }, content: { type: String, default: "" }, status: { type: String, enum: ["draft", "published", "unpublished", "archived"], default: "draft" }, origin: { type: String, enum: ["editorial", "rss"], required: true }, authorId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true }, categoryIds: [{ type: Schema.Types.ObjectId, ref: "Category" }], tagIds: [{ type: Schema.Types.ObjectId, ref: "Tag" }], featuredImage: imageSchema, publishedAt: Date, seoTitle: String, seoDescription: String, sourceName: String, sourceUrl: String, rssGuid: String, contentHash: String,
    }, timestamps);
    articleSchema.index({ status: 1, publishedAt: -1 });
    articleSchema.index({ sourceUrl: 1 }, { unique: true, sparse: true });
    articleSchema.index({ rssGuid: 1, sourceName: 1 }, { unique: true, sparse: true });
    model("Article", articleSchema);
  }

  if (!models.RssSource) model("RssSource", new Schema({ name: { type: String, required: true }, feedUrl: { type: String, required: true, unique: true }, categoryId: { type: Schema.Types.ObjectId, ref: "Category", required: true }, intervalMinutes: { type: Number, required: true, min: 15 }, active: { type: Boolean, default: true }, nextRunAt: { type: Date, index: true }, lastRunAt: Date, lastError: String, lastImportedCount: { type: Number, default: 0 } }, timestamps));

  if (!models.RssImport) model("RssImport", new Schema({ sourceId: { type: Schema.Types.ObjectId, ref: "RssSource", required: true, index: true }, status: { type: String, enum: ["success", "partial", "failed"], required: true }, importedCount: { type: Number, default: 0 }, skippedCount: { type: Number, default: 0 }, error: String, articleIds: [{ type: Schema.Types.ObjectId, ref: "Article" }] }, { timestamps: { createdAt: true, updatedAt: false } }));

  if (!models.Media) {
    const variantSchema = new Schema({
      width: { type: Number, required: true },
      format: { type: String, enum: ["webp", "avif"], required: true },
      key: { type: String, required: true },
      url: { type: String, required: true },
      size: { type: Number, required: true },
    }, { _id: false });
    model("Media", new Schema({
      key: { type: String, required: true, unique: true },
      url: { type: String, required: true },
      filename: { type: String, required: true },
      contentType: { type: String, required: true },
      size: { type: Number, required: true },
      width: { type: Number, default: 0 },
      height: { type: Number, default: 0 },
      alt: { type: String, default: "" },
      caption: { type: String, default: "" },
      credit: { type: String, default: "" },
      uploadedById: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
      usageCount: { type: Number, default: 0 },
      variants: [variantSchema],
    }, timestamps));
  }

  // Recover stale jobs from previous worker run
  const recovered = await recoverStaleJobs();
  if (recovered > 0) log(`Recovered ${recovered} stale job(s)`);

  // Start main loop
  mainLoop().catch((error) => {
    log(`Fatal error in main loop: ${error.message}`, "error");
    process.exit(1);
  });
}

// --- Shutdown -------------------------------------------------------------

async function shutdown(signal: string): Promise<void> {
  log(`Received ${signal}, shutting down gracefully...`);
  running = false;

  // Wait a moment for current job to finish
  await new Promise((resolve) => setTimeout(resolve, 2000));

  try {
    if (redis) {
      await redis.quit();
      log("Redis connection closed");
    }
    if (mongoConn) {
      await mongoose.disconnect();
      log("MongoDB connection closed");
    }
  } catch (error) {
    log(`Error during shutdown: ${error instanceof Error ? error.message : "unknown"}`, "error");
  }

  log("Worker stopped");
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("uncaughtException", (error) => {
  log(`Uncaught exception: ${error.message}`, "error");
  shutdown("uncaughtException");
});

// Start the worker
start().catch((error) => {
  log(`Failed to start worker: ${error.message}`, "error");
  process.exit(1);
});
