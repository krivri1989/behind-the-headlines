import { getLatestNews, getVisibleCategories, getSiteSettingsPublic } from "@/lib/public-data";
import type { MetadataRoute } from "next";

export const dynamic = "force-dynamic";
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [articles, categories, settings] = await Promise.all([
    getLatestNews(500),
    getVisibleCategories(),
    getSiteSettingsPublic(),
  ]);

  const canonicalHost = (settings?.canonicalHost as string) || "";
  const base = canonicalHost || "https://example.com";

  const staticPages: MetadataRoute.Sitemap = [
    { url: base, lastModified: new Date(), changeFrequency: "always", priority: 1.0 },
    { url: base + "/search", lastModified: new Date(), changeFrequency: "daily", priority: 0.6 },
  ];

  const categoryPages: MetadataRoute.Sitemap = categories.map((cat) => ({
    url: base + "/category/" + cat.slug,
    lastModified: new Date(),
    changeFrequency: "hourly" as const,
    priority: 0.8,
  }));

  const articlePages: MetadataRoute.Sitemap = articles.map((article) => ({
    url: base + "/article/" + article.slug,
    lastModified: new Date(article.updatedAt),
    changeFrequency: "daily" as const,
    priority: 0.7,
  }));

  return [...staticPages, ...categoryPages, ...articlePages];
}
