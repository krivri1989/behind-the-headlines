import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const uri = process.env.MONGODB_URI;
if (!uri) { console.error("MONGODB_URI is not set"); process.exit(1); }

const adminName = process.env.INITIAL_ADMIN_NAME;
const adminEmail = process.env.INITIAL_ADMIN_EMAIL;
const adminPassword = process.env.INITIAL_ADMIN_PASSWORD;

if (!adminName || !adminEmail || !adminPassword) {
  console.error("INITIAL_ADMIN_NAME, INITIAL_ADMIN_EMAIL, and INITIAL_ADMIN_PASSWORD must be set");
  process.exit(1);
}

console.log("Connecting to MongoDB...");
await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
console.log("✓ Connected to", mongoose.connection.name);

const db = mongoose.connection.db;

const users = db.collection("users");
const existing = await users.findOne({ email: adminEmail.toLowerCase() });
if (existing) {
  console.log("Admin user already exists:", adminEmail);
} else {
  const passwordHash = await bcrypt.hash(adminPassword, 12);
  await users.insertOne({
    name: adminName,
    email: adminEmail.toLowerCase(),
    passwordHash,
    role: "admin",
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  console.log("✓ Admin user created:", adminEmail);
}

const categories = db.collection("categories");
const catCount = await categories.countDocuments();
if (catCount === 0) {
  const seedCategories = [
    { name: "India", slug: "india", description: "News from across India", visible: true, order: 0, createdAt: new Date(), updatedAt: new Date() },
    { name: "Business", slug: "business", description: "Business and economy", visible: true, order: 1, createdAt: new Date(), updatedAt: new Date() },
    { name: "Technology", slug: "technology", description: "Technology and innovation", visible: true, order: 2, createdAt: new Date(), updatedAt: new Date() },
    { name: "World", slug: "world", description: "World news", visible: true, order: 3, createdAt: new Date(), updatedAt: new Date() },
    { name: "Culture", slug: "culture", description: "Arts, culture, and lifestyle", visible: true, order: 4, createdAt: new Date(), updatedAt: new Date() },
  ];
  await categories.insertMany(seedCategories);
  console.log("✓ Seeded", seedCategories.length, "categories");
} else {
  console.log("Categories already exist:", catCount);
}

const settings = db.collection("sitesettings");
const settingsCount = await settings.countDocuments();
if (settingsCount === 0) {
  await settings.insertOne({
    publicationName: "Behind The Headlines",
    tagline: "Independent reporting, analysis, and stories that matter.",
    language: "English",
    timezone: "Asia/Kolkata",
    contactEmail: adminEmail,
    seoTitle: "Behind The Headlines | Independent News",
    metaDescription: "Independent reporting, analysis, and stories that matter.",
    keywords: "news, india, business, technology, world",
    canonicalHost: process.env.APP_URL || "http://localhost:3000",
    primaryColor: "#4b2739",
    accentColor: "#bd8b32",
    logoUrl: "",
    faviconUrl: "",
    rssDefaultAuthor: "RSS Feed",
    articlePageSize: 24,
    enableComments: false,
    cookieConsent: true,
    advertisingEnabled: false,
    adPlacements: [
      { location: "header", enabled: false, allowlist: "", scriptUrl: "" },
      { location: "body", enabled: false, allowlist: "", scriptUrl: "" },
      { location: "footer", enabled: false, allowlist: "", scriptUrl: "" },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  console.log("✓ Seeded site settings");
} else {
  console.log("Site settings already exist");
}

const menus = db.collection("menus");
const menuCount = await menus.countDocuments();
if (menuCount === 0) {
  await menus.insertMany([
    { location: "header", items: [
      { label: "Home", href: "/", order: 0, visible: true },
      { label: "India", href: "/india", order: 1, visible: true },
      { label: "Business", href: "/business", order: 2, visible: true },
      { label: "Technology", href: "/technology", order: 3, visible: true },
      { label: "World", href: "/world", order: 4, visible: true },
      { label: "Culture", href: "/culture", order: 5, visible: true },
    ], createdAt: new Date(), updatedAt: new Date() },
    { location: "footer", items: [
      { label: "About", href: "/about", order: 0, visible: true },
      { label: "Contact", href: "/contact", order: 1, visible: true },
      { label: "Privacy", href: "/privacy", order: 2, visible: true },
      { label: "Terms", href: "/terms", order: 3, visible: true },
      { label: "Copyright", href: "/copyright", order: 4, visible: true },
    ], createdAt: new Date(), updatedAt: new Date() },
  ]);
  console.log("✓ Seeded header and footer menus");
} else {
  console.log("Menus already exist:", menuCount);
}

await mongoose.disconnect();
console.log("✓ Seed complete");
process.exit(0);
