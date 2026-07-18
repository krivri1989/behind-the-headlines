/**
 * Fix broken image URLs in the database.
 *
 * The RSS worker on the VPS stored image URLs using `host.docker.internal`
 * which is only reachable inside the Docker network. This script replaces
 * those with the publicly-accessible VPS IP.
 */
import mongoose from "mongoose";

const uri = process.env.MONGODB_URI;
if (!uri) { console.error("MONGODB_URI is not set"); process.exit(1); }

const BAD_HOST = process.env.BAD_HOST || "host.docker.internal:32769";
const GOOD_HOST = process.env.GOOD_HOST || "200.97.175.18:32769";

console.log("Connecting to MongoDB...");
await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
console.log("✓ Connected to", mongoose.connection.name);

const db = mongoose.connection.db;
const articles = db.collection("articles");
const media = db.collection("media");

// Fix articles.featuredImage.url and variants[].url
const articlesWithBadUrls = await articles.find({
  $or: [
    { "featuredImage.url": { $regex: BAD_HOST } },
    { "featuredImage.variants.url": { $regex: BAD_HOST } },
  ],
}).toArray();

console.log(`Found ${articlesWithBadUrls.length} articles with bad image URLs`);

for (const article of articlesWithBadUrls) {
  const updates = {};
  const fi = article.featuredImage;
  if (fi?.url && fi.url.includes(BAD_HOST)) {
    updates["featuredImage.url"] = fi.url.replaceAll(BAD_HOST, GOOD_HOST);
  }
  if (fi?.variants && Array.isArray(fi.variants)) {
    updates["featuredImage.variants"] = fi.variants.map((v) => ({
      ...v,
      url: v.url?.replaceAll(BAD_HOST, GOOD_HOST) || v.url,
    }));
  }
  if (Object.keys(updates).length > 0) {
    await articles.updateOne({ _id: article._id }, { $set: updates });
  }
}

// Fix article content that may contain inline images with bad URLs
const articlesWithBadContent = await articles.find({
  content: { $regex: BAD_HOST },
}).toArray();

console.log(`Found ${articlesWithBadContent.length} articles with bad inline image URLs`);

for (const article of articlesWithBadContent) {
  const fixedContent = article.content.replaceAll(BAD_HOST, GOOD_HOST);
  await articles.updateOne({ _id: article._id }, { $set: { content: fixedContent } });
}

// Fix media collection
const mediaWithBadUrls = await media.find({
  $or: [
    { url: { $regex: BAD_HOST } },
    { "variants.url": { $regex: BAD_HOST } },
  ],
}).toArray();

console.log(`Found ${mediaWithBadUrls.length} media records with bad URLs`);

for (const m of mediaWithBadUrls) {
  const updates = {};
  if (m.url && m.url.includes(BAD_HOST)) {
    updates.url = m.url.replaceAll(BAD_HOST, GOOD_HOST);
  }
  if (m.variants && Array.isArray(m.variants)) {
    updates.variants = m.variants.map((v) => ({
      ...v,
      url: v.url?.replaceAll(BAD_HOST, GOOD_HOST) || v.url,
    }));
  }
  if (Object.keys(updates).length > 0) {
    await media.updateOne({ _id: m._id }, { $set: updates });
  }
}

await mongoose.disconnect();
console.log("✓ Fix complete");
process.exit(0);
