import { Schema, model, models } from "mongoose";

const timestamps = { timestamps: true };

const variantSchema = new Schema({
  width: { type: Number, required: true },
  format: { type: String, enum: ["webp", "avif"], required: true },
  key: { type: String, required: true },
  url: { type: String, required: true },
  size: { type: Number, required: true },
}, { _id: false });

const imageSchema = new Schema({
  url: { type: String, required: true },
  alt: { type: String, default: "" },
  caption: { type: String, default: "" },
  credit: { type: String, default: "" },
  width: { type: Number, default: 0 },
  height: { type: Number, default: 0 },
  variants: [variantSchema],
}, { _id: false });

export const User = models.User ?? model("User", new Schema({
  name: { type: String, required: true, trim: true }, email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true }, role: { type: String, enum: ["admin", "editor"], required: true, default: "editor" }, active: { type: Boolean, default: true }, resetTokenHash: String, resetTokenExpiresAt: Date,
}, timestamps));

export const Category = models.Category ?? model("Category", new Schema({ name: { type: String, required: true, trim: true }, slug: { type: String, required: true, unique: true, lowercase: true }, description: String, parentId: Schema.Types.ObjectId, visible: { type: Boolean, default: true }, order: { type: Number, default: 0 } }, timestamps));
export const Tag = models.Tag ?? model("Tag", new Schema({ name: { type: String, required: true, trim: true }, slug: { type: String, required: true, unique: true, lowercase: true } }, timestamps));

const articleSchema = new Schema({
  title: { type: String, required: true, trim: true }, slug: { type: String, required: true, unique: true, lowercase: true }, excerpt: { type: String, default: "" }, content: { type: String, default: "" }, status: { type: String, enum: ["draft", "published", "unpublished", "archived"], default: "draft" }, origin: { type: String, enum: ["editorial", "rss"], required: true }, authorId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true }, categoryIds: [{ type: Schema.Types.ObjectId, ref: "Category" }], tagIds: [{ type: Schema.Types.ObjectId, ref: "Tag" }], featuredImage: imageSchema, publishedAt: Date, seoTitle: String, seoDescription: String, sourceName: String, sourceUrl: String, rssGuid: String, contentHash: String,
}, timestamps);
articleSchema.index({ status: 1, publishedAt: -1 }); articleSchema.index({ categoryIds: 1, status: 1, publishedAt: -1 }); articleSchema.index({ authorId: 1, updatedAt: -1 }); articleSchema.index({ sourceUrl: 1 }, { unique: true, sparse: true }); articleSchema.index({ rssGuid: 1, sourceName: 1 }, { unique: true, sparse: true });
export const Article = models.Article ?? model("Article", articleSchema);

export const Menu = models.Menu ?? model("Menu", new Schema({ location: { type: String, enum: ["header", "footer"], unique: true, required: true }, items: [{ label: String, href: String, categoryId: Schema.Types.ObjectId, order: Number, visible: { type: Boolean, default: true } }] }, timestamps));
export const RssSource = models.RssSource ?? model("RssSource", new Schema({ name: { type: String, required: true }, feedUrl: { type: String, required: true, unique: true }, categoryId: { type: Schema.Types.ObjectId, ref: "Category", required: true }, intervalMinutes: { type: Number, required: true, min: 15 }, active: { type: Boolean, default: true }, nextRunAt: { type: Date, index: true }, lastRunAt: Date, lastError: String, lastImportedCount: { type: Number, default: 0 } }, timestamps));
export const Subscriber = models.Subscriber ?? model("Subscriber", new Schema({ email: { type: String, required: true, unique: true, lowercase: true }, status: { type: String, enum: ["subscribed", "unsubscribed"], default: "subscribed" }, consentedAt: { type: Date, required: true }, sourcePath: String, unsubscribeToken: { type: String, required: true, unique: true } }, timestamps));
export const AuditLog = models.AuditLog ?? model("AuditLog", new Schema({ actorId: { type: Schema.Types.ObjectId, ref: "User" }, action: { type: String, required: true }, entityType: { type: String, required: true }, entityId: String, metadata: Schema.Types.Mixed }, { timestamps: { createdAt: true, updatedAt: false } }));

const mediaSchema = new Schema({
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
}, timestamps);
export const Media = models.Media ?? model("Media", mediaSchema);

const rssImportSchema = new Schema({
  sourceId: { type: Schema.Types.ObjectId, ref: "RssSource", required: true, index: true },
  status: { type: String, enum: ["success", "partial", "failed"], required: true },
  importedCount: { type: Number, default: 0 },
  skippedCount: { type: Number, default: 0 },
  error: String,
  articleIds: [{ type: Schema.Types.ObjectId, ref: "Article" }],
}, { timestamps: { createdAt: true, updatedAt: false } });
export const RssImport = models.RssImport ?? model("RssImport", rssImportSchema);

const adPlacementSchema = new Schema({
  location: { type: String, enum: ["header", "body", "footer"], required: true },
  enabled: { type: Boolean, default: false },
  allowlist: { type: String, default: "" },
  scriptUrl: { type: String, default: "" },
}, { _id: false });

const siteSettingsSchema = new Schema({
  publicationName: { type: String, default: "Behind The Headlines" },
  tagline: { type: String, default: "Independent reporting, analysis, and stories that matter." },
  language: { type: String, default: "English" },
  timezone: { type: String, default: "Asia/Kolkata" },
  contactEmail: { type: String, default: "" },
  seoTitle: { type: String, default: "" },
  metaDescription: { type: String, default: "" },
  keywords: { type: String, default: "" },
  canonicalHost: { type: String, default: "" },
  primaryColor: { type: String, default: "#4b2739" },
  primaryTextColor: { type: String, default: "#ffffff" },
  accentColor: { type: String, default: "#bd8b32" },
  accentTextColor: { type: String, default: "#ffffff" },
  footerColor: { type: String, default: "#1a1a1a" },
  footerTextColor: { type: String, default: "#ffffff" },
  logoUrl: { type: String, default: "" },
  faviconUrl: { type: String, default: "" },
  defaultImageUrl: { type: String, default: "" },
  rssDefaultAuthor: { type: String, default: "RSS Feed" },
  articlePageSize: { type: Number, default: 24 },
  enableComments: { type: Boolean, default: false },
  cookieConsent: { type: Boolean, default: true },
  advertisingEnabled: { type: Boolean, default: false },
  adPlacements: [adPlacementSchema],
}, { timestamps: true });
export const SiteSettings = models.SiteSettings ?? model("SiteSettings", siteSettingsSchema);

const commentSchema = new Schema({
  articleId: { type: Schema.Types.ObjectId, ref: "Article", required: true, index: true },
  authorName: { type: String, required: true },
  authorEmail: { type: String, required: true },
  content: { type: String, required: true, maxlength: 2000 },
  status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending", index: true },
}, { timestamps: true });
export const Comment = models.Comment ?? model("Comment", commentSchema);

const pageSchema = new Schema({
  title: { type: String, required: true },
  slug: { type: String, required: true, unique: true, index: true },
  content: { type: String, default: "" },
  excerpt: { type: String, default: "" },
  status: { type: String, enum: ["draft", "published"], default: "draft", index: true },
  seoTitle: { type: String, default: "" },
  seoDescription: { type: String, default: "" },
  authorId: { type: Schema.Types.ObjectId, ref: "User" },
}, { timestamps: true });
export const Page = models.Page ?? model("Page", pageSchema);
