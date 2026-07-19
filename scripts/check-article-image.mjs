import { connectToDatabase } from "../src/lib/db.js";
import { Article } from "../src/lib/models.js";
import { getObjectUrl, isStorageConfigured } from "../src/lib/storage.js";

async function main() {
  const slug = process.argv[2];
  if (!slug) {
    console.log("Usage: node scripts/check-article-image.mjs <slug>");
    process.exit(1);
  }

  await connectToDatabase();
  const article = await Article.findOne({ slug }).lean();
  if (!article) {
    console.log("Article not found:", slug);
    return;
  }

  console.log("Title:", article.title);
  console.log("Featured image:", article.featuredImage ? JSON.stringify(article.featuredImage, null, 2) : "null");
  console.log("Source name:", article.sourceName);
  console.log("Origin:", article.origin);

  if (article.featuredImage?.key && isStorageConfigured()) {
    const directUrl = await getObjectUrl(article.featuredImage.key);
    console.log("Direct storage URL:", directUrl);
  }

  if (article.featuredImage?.url) {
    try {
      const res = await fetch(article.featuredImage.url, { method: "HEAD" });
      console.log("Image URL status:", res.status);
    } catch (err) {
      console.log("Image URL fetch error:", err.message);
    }
  }

  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
