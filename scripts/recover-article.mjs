#!/usr/bin/env node
/**
 * Article Recovery Script
 *
 * Recovers damaged or truncated RSS articles by fetching the original
 * content from the IANS CMS Detail API.
 *
 * Usage:
 *   node --env-file=.env.local scripts/recover-article.mjs <slug-or-id> --token <IANS_TOKEN>
 *   node --env-file=.env.local scripts/recover-article.mjs --url "https://ians.in/detail/slug/" --token <IANS_TOKEN>
 *   node --env-file=.env.local scripts/recover-article.mjs --all-damaged --token <IANS_TOKEN>
 *
 * The token can also be set via the IANS_TOKEN environment variable.
 * See scripts/RECOVERY.md for full documentation.
 */
import mongoose from "mongoose";
import sanitizeHtml from "sanitize-html";

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("MONGODB_URI is not set. Run with --env-file=.env.local");
  process.exit(1);
}

// Resolve IANS token from --token argument or IANS_TOKEN env var
const tokenArgIdx = process.argv.indexOf("--token");
const IANS_WEB_TOKEN = tokenArgIdx >= 0 ? process.argv[tokenArgIdx + 1] : process.env.IANS_TOKEN;
if (!IANS_WEB_TOKEN) {
  console.error("IANS token is required. Pass it via --token <TOKEN> or IANS_TOKEN env var.");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Content processing (mirrors src/lib/sanitize.ts + content-helpers.ts)
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

/**
 * SAFE version of stripAgencyArtifacts.
 * Requires a dash (--/—/–/-) before IANS for trailing sign-off removal.
 * Never removes in-body attributions like "he told IANS" or "Speaking to IANS".
 */
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

// ---------------------------------------------------------------------------
// IANS CMS API
// ---------------------------------------------------------------------------

async function fetchFromIansApi(slug) {
  const apiUrl = `https://cms.iansnews.in/api/elastic/news/detail/en/${slug}/?language=english&website=1`;
  const res = await fetch(apiUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0",
      "Referer": "https://ians.in/",
      "Authorization": `Bearer ${IANS_WEB_TOKEN}`,
    },
  });
  if (!res.ok) {
    throw new Error(`IANS API returned ${res.status} for slug: ${slug}`);
  }
  const data = await res.json();
  const results = data.results || [];
  if (results.length === 0) {
    throw new Error(`No results from IANS API for slug: ${slug}`);
  }
  return results[0];
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

// Find the first non-flag argument (skip --token and its value)
const cliArgs = process.argv.slice(2).filter((a, i, arr) => {
  if (a === "--token") return false;
  if (i > 0 && arr[i - 1] === "--token") return false;
  return true;
});
const arg = cliArgs[0];
if (!arg) {
  console.error("Usage: node --env-file=.env.local scripts/recover-article.mjs <slug-or-id | --url <url> | --all-damaged> --token <TOKEN>");
  process.exit(1);
}

await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
const db = mongoose.connection.db;

// Determine which articles to recover
let articles = [];

if (arg === "--all-damaged") {
  console.log("Finding damaged articles (content ending mid-sentence)...");
  const all = await db.collection("articles").find({ origin: "rss" }).toArray();
  articles = all.filter(a => {
    const c = (a.content || "").trim();
    const endsWith = c.slice(-80).replace(/<[^>]*>/g, " ").trim();
    return /\b(told|Speaking to|spoke to|Talking to|had told|earlier told|Speaking exclusively to)\s*$/i.test(endsWith);
  });
  console.log(`Found ${articles.length} damaged articles`);
} else if (arg === "--url") {
  const url = cliArgs[1];
  if (!url) { console.error("--url requires a URL argument"); process.exit(1); }
  articles = await db.collection("articles").find({ sourceUrl: url }).toArray();
} else if (arg.length === 24 && /^[0-9a-f]+$/i.test(arg)) {
  // Looks like a MongoDB ObjectId
  articles = await db.collection("articles").find({ _id: new mongoose.Types.ObjectId(arg) }).toArray();
} else {
  // Treat as a slug — search by sourceUrl containing the slug
  articles = await db.collection("articles").find({
    origin: "rss",
    $or: [
      { sourceUrl: new RegExp(arg, "i") },
      { slug: new RegExp(arg, "i") },
    ],
  }).toArray();
}

if (articles.length === 0) {
  console.log("No matching articles found.");
  await mongoose.disconnect();
  process.exit(0);
}

let restored = 0;
let failed = 0;

for (const article of articles) {
  const slug = article.sourceUrl?.replace("https://ians.in/detail/", "").replace(/\/$/, "");
  console.log(`\n--- ${article.title?.slice(0, 60)}`);
  console.log(`  slug: ${slug}`);
  console.log(`  current content: ${(article.content || "").length} chars`);

  if (!slug) {
    console.log("  ✗ No sourceUrl — cannot recover");
    failed++;
    continue;
  }

  try {
    const apiResult = await fetchFromIansApi(slug);
    const rawContent = apiResult.content || "";
    console.log(`  fetched content: ${rawContent.length} chars`);

    if (rawContent.length > (article.content || "").length + 50) {
      const cleaned = stripAgencyArtifactsSafe(stripLeadingImages(sanitizeRssContent(rawContent)));
      await db.collection("articles").updateOne(
        { _id: article._id },
        { $set: { content: cleaned } }
      );
      console.log(`  ✓ RESTORED: ${(article.content||"").length} → ${cleaned.length} chars`);
      restored++;
    } else {
      console.log(`  ⚠ Fetched content not longer — current article may already be complete`);
      failed++;
    }

    await new Promise(r => setTimeout(r, 1000));
  } catch (err) {
    console.log(`  ✗ ${err.message}`);
    failed++;
  }
}

console.log(`\n=== DONE ===`);
console.log(`Restored: ${restored}/${articles.length}`);
console.log(`Failed/Skipped: ${failed}/${articles.length}`);

await mongoose.disconnect();
