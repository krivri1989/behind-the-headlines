import { connectToDatabase } from "./db";
import { Article, Category, Tag, Menu, RssSource, Subscriber, AuditLog, Media, SiteSettings, User, RssImport } from "./models";
import { getSession } from "./auth";
import { cacheGet, cacheSet, invalidateContentCache, invalidateSettingsCache, invalidateMenuCache, invalidateCategoriesCache, invalidateArticleCache, cacheKeys } from "./redis";
import { listAllObjects, getObjectUrl, isStorageConfigured } from "./storage";
import type { Document } from "mongoose";

type AnyDoc = Document & { _id: unknown };

function toObject<T extends AnyDoc>(doc: T | null): Record<string, unknown> | null {
  if (!doc) return null;
  const obj = doc.toObject({ virtuals: false }) as Record<string, unknown>;
  obj.id = String(obj._id);
  delete obj._id;
  delete obj.__v;
  return obj;
}

function toObjects<T extends AnyDoc>(docs: T[]): Record<string, unknown>[] {
  return docs.map((doc) => toObject(doc) as Record<string, unknown>);
}

function slugify(text: string) {
  return text.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export async function getCurrentUser() {
  const session = await getSession();
  if (!session) return null;
  return session;
}

type CategoryItem = { id: string; name: string; slug: string; description?: string; visible: boolean; order: number; parentId?: string };

export async function getCategories(): Promise<CategoryItem[]> {
  const cached = await cacheGet<CategoryItem[]>(cacheKeys.categories);
  if (cached) return cached;
  await connectToDatabase();
  const categories = await Category.find().sort({ order: 1, name: 1 }).lean();
  const result = categories.map((c) => ({ ...c, id: String(c._id) })) as unknown as CategoryItem[];
  await cacheSet(cacheKeys.categories, result, 600);
  return result;
}

export async function createCategory(input: { name: string; description?: string; visible?: boolean; parentId?: string }) {
  await connectToDatabase();
  const slug = slugify(input.name);
  const order = await Category.countDocuments();
  const category = await Category.create({ name: input.name.trim(), slug, description: input.description || "", visible: input.visible ?? true, parentId: input.parentId || undefined, order });
  await invalidateCategoriesCache();
  return toObject(category);
}

export async function updateCategory(id: string, input: Partial<{ name: string; description: string; visible: boolean; parentId: string; slug: string }>) {
  await connectToDatabase();
  const update: Record<string, unknown> = {};
  if (input.name !== undefined) { update.name = input.name.trim(); update.slug = slugify(input.name); }
  if (input.description !== undefined) update.description = input.description;
  if (input.visible !== undefined) update.visible = input.visible;
  if (input.parentId !== undefined) update.parentId = input.parentId || undefined;
  if (input.slug !== undefined) update.slug = input.slug;
  const category = await Category.findByIdAndUpdate(id, update, { new: true });
  await invalidateCategoriesCache();
  return toObject(category);
}

export async function deleteCategory(id: string) {
  await connectToDatabase();
  await Category.findByIdAndDelete(id);
  await invalidateCategoriesCache();
  return true;
}

export async function reorderCategories(orderedIds: string[]) {
  await connectToDatabase();
  for (let i = 0; i < orderedIds.length; i++) {
    await Category.findByIdAndUpdate(orderedIds[i], { order: i });
  }
  await invalidateCategoriesCache();
  return true;
}

export async function getTags() {
  await connectToDatabase();
  const tags = await Tag.find().sort({ name: 1 }).lean();
  return tags.map((t) => ({ ...t, id: String(t._id) }));
}

export async function createTag(name: string) {
  await connectToDatabase();
  const slug = slugify(name);
  const tag = await Tag.create({ name: name.trim(), slug });
  return toObject(tag);
}

export async function deleteTag(id: string) {
  await connectToDatabase();
  await Tag.findByIdAndDelete(id);
  return true;
}

export async function getArticles(options: { status?: string; search?: string; authorId?: string; limit?: number; page?: number } = {}) {
  await connectToDatabase();
  const filter: Record<string, unknown> = {};
  if (options.status && options.status !== "All") filter.status = options.status.toLowerCase();
  if (options.authorId) filter.authorId = options.authorId;
  if (options.search) filter.title = { $regex: options.search, $options: "i" };
  const limit = options.limit ?? 50;
  const page = options.page ?? 1;
  const skip = (page - 1) * limit;
  const [articles, total] = await Promise.all([
    Article.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(limit).populate("authorId", "name email").populate("categoryIds", "name slug").lean() as unknown as Array<Record<string, unknown>>,
    Article.countDocuments(filter),
  ]);
  return {
    articles: articles.map((a) => ({
      ...a,
      id: String(a._id),
      author: a.authorId && typeof a.authorId === "object" && !Array.isArray(a.authorId) ? (a.authorId as { name: string }).name : "Unknown",
      categories: Array.isArray(a.categoryIds) ? a.categoryIds.map((c: { name: string }) => c.name) : [],
    })),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

export async function bulkDeleteArticles(ids: string[]) {
  await connectToDatabase();
  const result = await Article.deleteMany({ _id: { $in: ids } });
  await invalidateArticleCache();
  return { deletedCount: result.deletedCount };
}

export async function getArticleById(id: string) {
  await connectToDatabase();
  const article = await Article.findById(id).populate("authorId", "name email").populate("categoryIds", "name slug").populate("tagIds", "name slug").lean() as unknown as Record<string, unknown> | null;
  if (!article) return null;
  return { ...article, id: String(article._id) };
}

export async function createArticle(input: { title: string; excerpt?: string; content?: string; status?: string; authorId: string; categoryIds?: string[]; tagIds?: string[]; origin?: string; seoTitle?: string; seoDescription?: string }) {
  await connectToDatabase();
  const slug = slugify(input.title);
  const article = await Article.create({
    title: input.title.trim(),
    slug,
    excerpt: input.excerpt || "",
    content: input.content || "",
    status: input.status || "draft",
    origin: input.origin || "editorial",
    authorId: input.authorId,
    categoryIds: input.categoryIds || [],
    tagIds: input.tagIds || [],
    seoTitle: input.seoTitle,
    seoDescription: input.seoDescription,
    publishedAt: input.status === "published" ? new Date() : undefined,
  });
  await invalidateArticleCache(slug);
  return toObject(article);
}

export async function updateArticle(id: string, input: Partial<{ title: string; excerpt: string; content: string; status: string; categoryIds: string[]; tagIds: string[]; seoTitle: string; seoDescription: string; featuredImage: { url: string; alt: string; caption: string; credit: string } }>) {
  await connectToDatabase();
  const update: Record<string, unknown> = {};
  if (input.title !== undefined) { update.title = input.title.trim(); update.slug = slugify(input.title); }
  if (input.excerpt !== undefined) update.excerpt = input.excerpt;
  if (input.content !== undefined) update.content = input.content;
  if (input.status !== undefined) {
    update.status = input.status;
    if (input.status === "published") update.publishedAt = new Date();
  }
  if (input.categoryIds !== undefined) update.categoryIds = input.categoryIds;
  if (input.tagIds !== undefined) update.tagIds = input.tagIds;
  if (input.seoTitle !== undefined) update.seoTitle = input.seoTitle;
  if (input.seoDescription !== undefined) update.seoDescription = input.seoDescription;
  if (input.featuredImage !== undefined) update.featuredImage = input.featuredImage;
  const article = await Article.findByIdAndUpdate(id, update, { new: true });
  await invalidateArticleCache();
  return toObject(article);
}

export async function deleteArticle(id: string) {
  await connectToDatabase();
  await Article.findByIdAndDelete(id);
  await invalidateArticleCache();
  return true;
}

export async function getMenus() {
  await connectToDatabase();
  const menus = await Menu.find().lean();
  return menus.map((m) => ({ ...m, id: String(m._id) }));
}

export async function getMenuByLocation(location: "header" | "footer") {
  const cacheKey = location === "header" ? cacheKeys.headerMenu : cacheKeys.footerMenu;
  const cached = await cacheGet<Record<string, unknown> & { id: string }>(cacheKey);
  if (cached) return cached;
  await connectToDatabase();
  const menu = await Menu.findOne({ location }).lean() as unknown as Record<string, unknown> | null;
  if (!menu) return null;
  const result = { ...menu, id: String(menu._id) };
  await cacheSet(cacheKey, result, 600);
  return result;
}

export async function updateMenuItems(location: "header" | "footer", items: { label: string; href: string; order: number; visible: boolean }[]) {
  await connectToDatabase();
  const menu = await Menu.findOneAndUpdate({ location }, { items }, { new: true, upsert: true });
  await invalidateMenuCache();
  return toObject(menu);
}

export async function getRssSources() {
  await connectToDatabase();
  const sources = await RssSource.find().populate("categoryId", "name slug").sort({ createdAt: -1 }).lean() as unknown as Array<Record<string, unknown>>;
  return sources.map((s) => ({
    ...s,
    id: String(s._id),
    category: s.categoryId && typeof s.categoryId === "object" && !Array.isArray(s.categoryId) ? (s.categoryId as { name: string }).name : "Uncategorized",
  }));
}

export async function createRssSource(input: { name: string; feedUrl: string; categoryId: string; intervalMinutes: number; active?: boolean }) {
  await connectToDatabase();
  const source = await RssSource.create({
    name: input.name.trim(),
    feedUrl: input.feedUrl.trim(),
    categoryId: input.categoryId,
    intervalMinutes: input.intervalMinutes,
    active: input.active ?? true,
    nextRunAt: input.active !== false ? new Date() : undefined,
  });
  return toObject(source);
}

export async function updateRssSource(id: string, input: Partial<{ name: string; feedUrl: string; categoryId: string; intervalMinutes: number; active: boolean }>) {
  await connectToDatabase();
  const update: Record<string, unknown> = {};
  if (input.name !== undefined) update.name = input.name.trim();
  if (input.feedUrl !== undefined) update.feedUrl = input.feedUrl.trim();
  if (input.categoryId !== undefined) update.categoryId = input.categoryId;
  if (input.intervalMinutes !== undefined) update.intervalMinutes = input.intervalMinutes;
  if (input.active !== undefined) {
    update.active = input.active;
    update.nextRunAt = input.active ? new Date() : undefined;
  }
  const source = await RssSource.findByIdAndUpdate(id, update, { new: true });
  return toObject(source);
}

export async function deleteRssSource(id: string) {
  await connectToDatabase();
  await RssSource.findByIdAndDelete(id);
  return true;
}

export async function getSubscribers(options: { search?: string; status?: string } = {}) {
  await connectToDatabase();
  const filter: Record<string, unknown> = {};
  if (options.status && options.status !== "All") filter.status = options.status;
  if (options.search) filter.email = { $regex: options.search, $options: "i" };
  const subscribers = await Subscriber.find(filter).sort({ createdAt: -1 }).lean();
  return subscribers.map((s) => ({ ...s, id: String(s._id) }));
}

export async function createSubscriber(input: { email: string; sourcePath?: string }) {
  await connectToDatabase();
  const token = crypto.randomUUID();
  const subscriber = await Subscriber.create({
    email: input.email.trim().toLowerCase(),
    consentedAt: new Date(),
    sourcePath: input.sourcePath || "manual",
    unsubscribeToken: token,
  });
  return toObject(subscriber);
}

export async function updateSubscriberStatus(id: string, status: "subscribed" | "unsubscribed") {
  await connectToDatabase();
  const subscriber = await Subscriber.findByIdAndUpdate(id, { status }, { new: true });
  return toObject(subscriber);
}

export async function deleteSubscriber(id: string) {
  await connectToDatabase();
  await Subscriber.findByIdAndDelete(id);
  return true;
}

export async function getEditors() {
  await connectToDatabase();
  const users = await User.find().sort({ createdAt: 1 }).lean();
  return users.map((u) => ({
    ...u,
    id: String(u._id),
    status: u.active ? "Active" : "Blocked",
    role: u.role === "admin" ? "Administrator" : "Editor",
  }));
}

export async function getDashboardStats(options: { authorId?: string } = {}) {
  await connectToDatabase();
  const articleFilter: Record<string, unknown> = {};
  if (options.authorId) articleFilter.authorId = options.authorId;

  const [
    totalArticles,
    publishedArticles,
    draftArticles,
    archivedArticles,
    totalRssSources,
    activeRssSources,
    rssSourcesWithErrors,
    totalSubscribers,
    subscribedSubscribers,
    totalEditors,
    totalCategories,
  ] = await Promise.all([
    Article.countDocuments(articleFilter),
    Article.countDocuments({ ...articleFilter, status: "published" }),
    Article.countDocuments({ ...articleFilter, status: "draft" }),
    Article.countDocuments({ ...articleFilter, status: "archived" }),
    RssSource.countDocuments(),
    RssSource.countDocuments({ active: true }),
    RssSource.countDocuments({ active: true, lastError: { $ne: null } }),
    Subscriber.countDocuments(),
    Subscriber.countDocuments({ status: "subscribed" }),
    User.countDocuments(),
    Category.countDocuments(),
  ]);

  return {
    articles: {
      total: totalArticles,
      published: publishedArticles,
      draft: draftArticles,
      archived: archivedArticles,
    },
    rssSources: {
      total: totalRssSources,
      active: activeRssSources,
      errors: rssSourcesWithErrors,
    },
    subscribers: {
      total: totalSubscribers,
      subscribed: subscribedSubscribers,
    },
    editors: totalEditors,
    categories: totalCategories,
  };
}

export async function createEditor(input: { name: string; email: string; role: "admin" | "editor"; password?: string }) {
  await connectToDatabase();
  const password = (input.password || crypto.randomUUID().slice(0, 16)).slice(0, 100);
  const passwordHash = await import("bcryptjs").then((b) => b.hash(password, 12));
  const user = await User.create({
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    passwordHash,
    role: input.role,
    active: true,
  });
  return toObject(user);
}

export async function resetEditorPassword(id: string, password: string) {
  await connectToDatabase();
  if (!password || password.length < 6) throw new Error("Password must be at least 6 characters.");
  const passwordHash = await import("bcryptjs").then((b) => b.hash(password.slice(0, 100), 12));
  const user = await User.findByIdAndUpdate(id, { passwordHash, active: true }, { new: true });
  return toObject(user);
}

export async function updateEditor(id: string, input: Partial<{ name: string; email: string; role: "admin" | "editor"; active: boolean }>) {
  await connectToDatabase();
  const update: Record<string, unknown> = {};
  if (input.name !== undefined) update.name = input.name.trim();
  if (input.email !== undefined) update.email = input.email.trim().toLowerCase();
  if (input.role !== undefined) update.role = input.role;
  if (input.active !== undefined) update.active = input.active;
  const user = await User.findByIdAndUpdate(id, update, { new: true });
  return toObject(user);
}

export async function deleteEditor(id: string) {
  await connectToDatabase();
  await User.findByIdAndDelete(id);
  return true;
}

export async function getAuditLogs(options: { search?: string; category?: string; limit?: number } = {}) {
  await connectToDatabase();
  const filter: Record<string, unknown> = {};
  if (options.category && options.category !== "All") filter.entityType = options.category;
  if (options.search) filter.action = { $regex: options.search, $options: "i" };
  const limit = options.limit ?? 50;
  const logs = await AuditLog.find(filter).sort({ createdAt: -1 }).limit(limit).lean();
  return logs.map((l) => ({ ...l, id: String(l._id) }));
}

export async function createAuditLog(input: { actorId?: string; action: string; entityType: string; entityId?: string; metadata?: Record<string, unknown> }) {
  await connectToDatabase();
  const log = await AuditLog.create(input);
  return toObject(log);
}

/**
 * Sync objects from RustFS into the Media collection.
 * Lists all objects in both "media/" and "rss-images/" prefixes and creates
 * Media records for any that don't already exist (keyed by S3 key).
 * Returns the number of newly created records.
 */
export async function syncMediaFromStorage(): Promise<number> {
  if (!isStorageConfigured()) return 0;
  await connectToDatabase();
  const objects = await listAllObjects(["media/", "rss-images/"]);
  if (objects.length === 0) return 0;

  // Get all existing keys in one query
  const existing = await Media.find({ key: { $in: objects.map((o) => o.key) } }).select("key").lean();
  const existingKeys = new Set(existing.map((m) => m.key));

  // Find or create the RSS system user for orphaned RSS images
  const systemUser = await User.findOne({ email: "rss-system@behind-the-headlines.local" }).select("_id").lean() as unknown as { _id: unknown } | null;
  let systemUserId: string;
  if (systemUser) {
    systemUserId = String(systemUser._id);
  } else {
    // Use the first admin user as fallback
    const admin = await User.findOne({ role: "admin" }).select("_id").lean() as unknown as { _id: unknown } | null;
    if (!admin) return 0; // no users yet, can't create media records
    systemUserId = String(admin._id);
  }

  const toCreate = objects.filter((obj) => !existingKeys.has(obj.key));
  if (toCreate.length === 0) return 0;

  const docs = toCreate.map((obj) => ({
    key: obj.key,
    url: getObjectUrl(obj.key),
    filename: obj.key.split("/").pop() || obj.key,
    contentType: obj.contentType,
    size: obj.size,
    alt: "",
    caption: "",
    credit: obj.key.startsWith("rss-images/") ? "RSS import" : "",
    uploadedById: systemUserId,
  }));

  await Media.insertMany(docs, { ordered: false });
  return docs.length;
}

export async function getMediaLibrary(options: { search?: string; limit?: number; page?: number } = {}) {
  await connectToDatabase();
  const filter: Record<string, unknown> = {};
  if (options.search) filter.filename = { $regex: options.search, $options: "i" };
  const limit = options.limit ?? 50;
  const page = options.page ?? 1;
  const skip = (page - 1) * limit;
  const [media, total] = await Promise.all([
    Media.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Media.countDocuments(filter),
  ]);
  return {
    media: media.map((m) => ({ ...m, id: String(m._id) })),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

export async function createMediaRecord(input: { key: string; url: string; filename: string; contentType: string; size: number; uploadedById: string; alt?: string; width?: number; height?: number; variants?: { width: number; format: "webp" | "avif"; key: string; url: string; size: number }[] }) {
  await connectToDatabase();
  const media = await Media.create({
    key: input.key,
    url: input.url,
    filename: input.filename,
    contentType: input.contentType,
    size: input.size,
    uploadedById: input.uploadedById,
    alt: input.alt || "",
    width: input.width || 0,
    height: input.height || 0,
    variants: input.variants || [],
  });
  return toObject(media);
}

export async function updateMedia(id: string, input: Partial<{ alt: string; caption: string; credit: string }>) {
  await connectToDatabase();
  const media = await Media.findByIdAndUpdate(id, input, { new: true });
  return toObject(media);
}

export async function deleteMedia(id: string) {
  await connectToDatabase();
  const media = await Media.findById(id).lean() as unknown as Record<string, unknown> | null;
  if (!media) return false;
  const { deleteFile } = await import("./storage");
  try { await deleteFile(media.key as string); } catch { /* object may already be deleted */ }
  await Media.findByIdAndDelete(id);
  return true;
}

export async function getSiteSettings() {
  const cached = await cacheGet<Record<string, unknown> & { id: string }>(cacheKeys.siteSettings);
  if (cached) return cached;
  await connectToDatabase();
  const settings = await SiteSettings.findOne().lean() as unknown as Record<string, unknown> | null;
  if (!settings) return null;
  const result = { ...settings, id: String(settings._id) };
  await cacheSet(cacheKeys.siteSettings, result, 600);
  return result;
}

export async function updateSiteSettings(input: Record<string, unknown>) {
  await connectToDatabase();
  const settings = await SiteSettings.findOneAndUpdate({}, input, { new: true, upsert: true });
  await invalidateSettingsCache();
  return toObject(settings);
}

type RssImportItem = {
  id: string;
  sourceId: string;
  sourceName: string;
  status: string;
  importedCount: number;
  skippedCount: number;
  error?: string;
  createdAt: string;
};

export async function getRssImports(options: { sourceId?: string; search?: string; limit?: number } = {}): Promise<RssImportItem[]> {
  await connectToDatabase();
  const filter: Record<string, unknown> = {};
  if (options.sourceId) filter.sourceId = options.sourceId;
  const limit = options.limit ?? 50;
  let imports = await RssImport.find(filter).sort({ createdAt: -1 }).limit(limit * 2).populate("sourceId", "name").lean() as Array<Record<string, unknown>>;
  let items = imports.map((i) => {
    const source = (i.sourceId as { name?: string } | null) ?? {};
    return {
      id: String(i._id),
      sourceId: typeof i.sourceId === "string" ? i.sourceId : String((i.sourceId as { _id: unknown } | null)?._id ?? ""),
      sourceName: source.name ?? "Unknown source",
      status: String(i.status ?? ""),
      importedCount: Number(i.importedCount ?? 0),
      skippedCount: Number(i.skippedCount ?? 0),
      error: i.error ? String(i.error) : undefined,
      createdAt: i.createdAt ? new Date(i.createdAt as string).toISOString() : new Date().toISOString(),
    };
  });
  if (options.search) {
    const q = options.search.toLowerCase();
    items = items.filter((it) => it.sourceName.toLowerCase().includes(q) || it.status.toLowerCase().includes(q) || (it.error && it.error.toLowerCase().includes(q)));
  }
  return items.slice(0, limit);
}
