#!/usr/bin/env node
/**
 * Backfill Script — Fetch missed articles directly from the IANS CMS API.
 *
 * Use this when the RSS worker/cron has been down for a day or more and
 * articles have expired from the RSS feeds. The IANS CMS API supports
 * pagination (200+ pages, 7+ days of history) and can recover articles
 * that are no longer in the RSS feeds.
 *
 * Usage:
 *   # Backfill all categories for the last N hours (default: 48)
 *   node --env-file=.env.local scripts/backfill-from-ians.mjs --hours 48 --token <IANS_TOKEN>
 *
 *   # Backfill a specific category only
 *   node --env-file=.env.local scripts/backfill-from-ians.mjs --hours 24 --category entertainment --token <IANS_TOKEN>
 *
 *   # Dry run (show what would be imported without saving)
 *   node --env-file=.env.local scripts/backfill-from-ians.mjs --hours 48 --dry-run --token <IANS_TOKEN>
 *
 *   # Backfill everything in the last 3 days
 *   node --env-file=.env.local scripts/backfill-from-ians.mjs --hours 72 --token <IANS_TOKEN>
 *
 * The token can also be set via the IANS_TOKEN environment variable.
 * See scripts/RECOVERY.md for full documentation.
 */
import mongoose from "mongoose";
import { XMLParser } from "fast-xml-parser";
import sanitizeHtml from "sanitize-html";

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("MONGODB_URI is not set. Run with --env-file=.env.local");
  process.exit(1);
}

// Parse CLI args
const args = process.argv.slice(2);
const hoursArg = args.find(a => a.startsWith("--hours"));
const HOURS = hoursArg ? parseInt(hoursArg.split("=")[1] || args[args.indexOf(hoursArg) + 1]) : 48;
const catArg = args.find(a => a.startsWith("--category"));
const CATEGORY_FILTER = catArg ? (catArg.split("=")[1] || args[args.indexOf(catArg) + 1]) : null;
const DRY_RUN = args.includes("--dry-run");

// Resolve IANS token from --token argument or IANS_TOKEN env var
const tokenArgIdx = args.indexOf("--token");
const IANS_WEB_TOKEN = tokenArgIdx >= 0 ? args[tokenArgIdx + 1] : process.env.IANS_TOKEN;
if (!IANS_WEB_TOKEN) {
  console.error("IANS token is required. Pass it via --token <TOKEN> or IANS_TOKEN env var.");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Maps IANS tag slugs to our RSS source names, with priority.
// IANS tags every article with "national" as a generic tag, so we need
// priority ordering — specific category tags must win over "national".
// ---------------------------------------------------------------------------
const TAG_PRIORITY = [
  // Specific categories first (highest priority)
  { tags: ["sports", "cricket", "football", "other-sports", "motorsports", "fifa-worldcup-2026"], source: "IANS - Sports" },
  { tags: ["entertainment", "cinema", "music"], source: "IANS - Entertainment" },
  { tags: ["business", "economy", "markets"], source: "IANS - Business" },
  { tags: ["science", "technology", "environment"], source: "IANS - Science/Tech" },
  { tags: ["health", "lifestyle"], source: "IANS - Health/Medicine" },
  { tags: ["international", "diplomacy", "security", "terrorism", "defence"], source: "IANS - World" },
  // National is lowest priority — only used if no specific category tag is present
  { tags: ["national", "politics", "crime", "law", "society", "education", "disaster", "accident", "religion", "human-interest", "opinion-specials"], source: "IANS - NAtional" },
];

function sourceFromTags(tagSlugs) {
  for (const group of TAG_PRIORITY) {
    for (const tag of tagSlugs) {
      if (group.tags.includes(tag)) return group.source;
    }
  }
  return "IANS - All News";
}

// ---------------------------------------------------------------------------
// Content processing
// ---------------------------------------------------------------------------

function sanitizeRssContent(html) {
  if (!html) return "";
  return sanitizeHtml(html, {
    allowedTags: [
      "p","br","hr","strong","b","em","i","u","s","del","ins","mark","small","sub","sup",
      "h1","h2","h3","h4","h5","h6","ul","ol","li","a","img","blockquote","q","cite","code","pre",
      "kbd","samp","table","thead","tbody","tfoot","tr","th","td","figure","figcaption","abbr",
      "address","time","details","summary","div","span",
    ],
    allowedAttributes: {
      a: ["href","title","target","rel"],
      img: ["src","alt","title","width","height","loading"],
      table: ["class"], th: ["scope","colspan","rowspan"], td: ["colspan","rowspan"],
      time: ["datetime"], abbr: ["title"], "*": ["class"],
    },
    allowedSchemes: ["http","https","mailto"],
    allowedStyles: {},
    allowProtocolRelative: false,
  });
}

function stripLeadingImages(html) {
  if (!html) return "";
  let r = html.trim();
  r = r.replace(/^<p[^>]*>\s*<img[^>]*>\s*<\/p>/i, "");
  r = r.replace(/^<figure[^>]*>\s*<img[^>]*>\s*(<figcaption[^>]*>.*?<\/figcaption>)?\s*<\/figure>/i, "");
  r = r.replace(/^<img[^>]*>/i, "");
  return r.trim();
}

function stripAgencyArtifactsSafe(html) {
  if (!html) return "";
  let result = html;
  const trailingSignoff = /(?:<p[^>]*>\s*(?:--|—|–|-)\s*(?:<\/p>\s*|\s*(?:<br\s*\/?>\s*)+))?<(?:p[^>]*|div[^>]*|span[^>]*|br\s*\/?)>\s*IANS(?:\/PIB)?[\s\S]*?(?:<\/p>\s*(?:<p[^>]*>(?:[\s\S]*?)<\/p>\s*)*)?$/i;
  result = result.replace(trailingSignoff, "");
  result = result.replace(/(?:--|—|–|-)\s*(?:<br\s*\/?>\s*)*\s*IANS(?:\/PIB)?[\s\S]*?$/i, "");
  result = result.replace(/^<p[^>]*>\s*(?:--|—|–|-)?\s*IANS(?:\/PIB)?\s*<\/p>\s*/i, "");
  result = result.replace(/\s*\((IANS|PTI|ANI|IANS\/PIB)\)\s*/i, " — ");
  result = result.replace(/(?:<p[^>]*>\s*(?:--|—|–)?\s*[a-z]{2,5}(?:\/[a-z]{2,5}){0,4}\s*<\/p>\s*)+$/i, "");
  result = result.replace(/(?:<p[^>]*>\s*[a-z]{2,5}\/\s*<\/p>\s*)+$/i, "");
  return result.trim();
}

function stripHtml(html) {
  return html.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

function contentHash(title, content) {
  const { createHash } = require("crypto");
  const normalized = (title + "|" + stripHtml(content).slice(0, 500)).toLowerCase().replace(/\s+/g, " ").trim();
  return createHash("md5").update(normalized).digest("hex");
}

function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

// ---------------------------------------------------------------------------
// IANS CMS API
// ---------------------------------------------------------------------------

async function fetchApiPage(page) {
  const url = `https://cms.iansnews.in/api/elastic/news/list/?language=english&website=1&page=${page}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0",
      "Referer": "https://ians.in/",
      "Authorization": `Bearer ${IANS_WEB_TOKEN}`,
    },
  });
  if (!res.ok) throw new Error(`API returned ${res.status} on page ${page}`);
  const data = await res.json();
  return data.results || [];
}

async function fetchArticleDetail(slug) {
  const url = `https://cms.iansnews.in/api/elastic/news/detail/en/${slug}/?language=english&website=1`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0",
      "Referer": "https://ians.in/",
      "Authorization": `Bearer ${IANS_WEB_TOKEN}`,
    },
  });
  if (!res.ok) throw new Error(`Detail API returned ${res.status} for slug: ${slug}`);
  const data = await res.json();
  const results = data.results || [];
  return results[0] || null;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

console.log(`\n=== IANS Backfill ===`);
console.log(`Time window: last ${HOURS} hours`);
console.log(`Category filter: ${CATEGORY_FILTER || "all"}`);
console.log(`Dry run: ${DRY_RUN ? "YES (no changes will be saved)" : "NO"}`);
console.log();

const cutoff = new Date(Date.now() - HOURS * 60 * 60 * 1000);
console.log(`Cutoff time: ${cutoff.toISOString()}`);
console.log(`Fetching articles after this time from the IANS CMS API...\n`);

await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
const db = mongoose.connection.db;

// Load RSS sources and their category mappings
const sources = await db.collection("rsssources").find({}).toArray();
const sourceMap = new Map(sources.map(s => [s.name, s]));
console.log(`Loaded ${sources.length} RSS sources`);

// Load existing article GUIDs/slugs for deduplication
const existingArticles = await db.collection("articles").find(
  { origin: "rss" },
  { projection: { sourceUrl: 1, rssGuid: 1, contentHash: 1 } }
).toArray();
const existingUrls = new Set(existingArticles.map(a => a.sourceUrl).filter(Boolean));
const existingGuids = new Set(existingArticles.map(a => a.rssGuid).filter(Boolean));
const existingHashes = new Set(existingArticles.map(a => a.contentHash).filter(Boolean));
console.log(`Loaded ${existingArticles.length} existing RSS articles for dedup\n`);

// Paginate through the API, collecting articles within the time window
let page = 1;
let scanned = 0;
let tooOld = false;
const candidates = [];

while (!tooOld && page <= 300) {
  try {
    const results = await fetchApiPage(page);
    if (results.length === 0) {
      console.log(`Page ${page}: no results, stopping`);
      break;
    }

    for (const r of results) {
      scanned++;
      const createdAt = new Date(r.created_at);

      // If article is older than cutoff, mark to stop after this page
      if (createdAt < cutoff) {
        tooOld = true;
        continue;
      }

      const slug = r.slug;
      const sourceUrl = `https://ians.in/detail/${slug}/`;

      // Skip if already imported
      if (existingUrls.has(sourceUrl) || existingGuids.has(slug)) {
        continue;
      }

      // Determine source by tags (priority-based: specific categories win over "national")
      const tags = r.tags || [];
      const tagSlugs = tags.map(t => t.slug);
      const sourceName = sourceFromTags(tagSlugs);

      // Apply category filter if specified
      if (CATEGORY_FILTER) {
        const source = sourceMap.get(sourceName);
        if (!source || !sourceName.toLowerCase().includes(CATEGORY_FILTER.toLowerCase())) {
          continue;
        }
      }

      candidates.push({
        slug,
        sourceUrl,
        sourceName,
        title: r.title,
        shortDesc: r.short_desc || "",
        createdAt,
        image: r.image || r.thumbnail || "",
        imageCaption: r.image_caption || "",
      });
    }

    if (page % 10 === 0) console.log(`Scanned page ${page} (${scanned} articles), ${candidates.length} new candidates`);
    page++;
    await new Promise(r => setTimeout(r, 400));
  } catch (err) {
    console.log(`Error on page ${page}: ${err.message}`);
    break;
  }
}

console.log(`\nScanned ${scanned} articles across ${page - 1} pages`);
console.log(`Found ${candidates.length} new articles not yet in database\n`);

if (candidates.length === 0) {
  console.log("Nothing to backfill. All articles are already imported.");
  await mongoose.disconnect();
  process.exit(0);
}

if (DRY_RUN) {
  console.log("=== DRY RUN — would import these articles ===\n");
  for (const c of candidates) {
    console.log(`  [${c.sourceName}] ${c.title?.slice(0, 60)}`);
    console.log(`    created: ${c.createdAt.toISOString()}`);
  }
  console.log(`\nTotal: ${candidates.length} articles (dry run, nothing saved)`);
  await mongoose.disconnect();
  process.exit(0);
}

// Import each candidate
let imported = 0;
let skipped = 0;
let failed = 0;

// Find or create a default author for RSS imports
let defaultAuthor = await db.collection("users").findOne({ role: "admin" });
if (!defaultAuthor) defaultAuthor = await db.collection("users").findOne({});
if (!defaultAuthor) {
  console.error("No user found in database — cannot import without an author");
  await mongoose.disconnect();
  process.exit(1);
}

for (const c of candidates) {
  const source = sourceMap.get(c.sourceName);
  if (!source) {
    console.log(`  ✗ No source config for "${c.sourceName}": ${c.title?.slice(0, 40)}`);
    skipped++;
    continue;
  }

  try {
    // Fetch full content from the detail API
    const detail = await fetchArticleDetail(c.slug);
    if (!detail || !detail.content) {
      console.log(`  ✗ No content from API: ${c.title?.slice(0, 40)}`);
      skipped++;
      continue;
    }

    const rawContent = detail.content;
    const sanitized = sanitizeRssContent(rawContent);
    const cleaned = stripAgencyArtifactsSafe(stripLeadingImages(sanitized));
    const excerpt = stripHtml(cleaned).slice(0, 300);

    // Check content hash dedup
    const hash = contentHash(c.title, cleaned);
    if (existingHashes.has(hash)) {
      skipped++;
      continue;
    }

    // Determine category from source
    const categoryIds = source.categoryIds || (source.categoryId ? [source.categoryId] : []);

    // Build featured image if available
    let featuredImage = null;
    if (c.image) {
      featuredImage = {
        url: c.image,
        alt: c.imageCaption || c.title,
        caption: c.imageCaption || "",
        credit: "IANS",
        width: 0,
        height: 0,
        variants: [],
      };
    }

    const articleSlug = c.slug; // Use IANS slug directly for consistency

    // Check if slug already exists
    const existingSlug = await db.collection("articles").findOne({ slug: articleSlug });
    if (existingSlug) {
      skipped++;
      continue;
    }

    const newArticle = {
      title: c.title,
      slug: articleSlug,
      excerpt,
      content: cleaned,
      status: "published",
      origin: "rss",
      authorId: defaultAuthor._id,
      categoryIds,
      tagIds: [],
      featuredImage,
      publishedAt: c.createdAt,
      sourceName: c.sourceName,
      sourceUrl: c.sourceUrl,
      rssGuid: c.slug,
      contentHash: hash,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await db.collection("articles").insertOne(newArticle);
    existingUrls.add(c.sourceUrl);
    existingGuids.add(c.slug);
    existingHashes.add(hash);

    console.log(`  ✓ [${c.sourceName}] ${c.title?.slice(0, 50)}`);
    imported++;
    await new Promise(r => setTimeout(r, 800));
  } catch (err) {
    console.log(`  ✗ Error: ${c.title?.slice(0, 40)} — ${err.message}`);
    failed++;
  }
}

console.log(`\n=== BACKFILL COMPLETE ===`);
console.log(`Imported: ${imported}`);
console.log(`Skipped (duplicates/no content): ${skipped}`);
console.log(`Failed: ${failed}`);

await mongoose.disconnect();
