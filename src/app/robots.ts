import { getSiteSettingsPublic } from "@/lib/public-data";
import type { MetadataRoute } from "next";

export const revalidate = 3600;

export default async function robots(): Promise<MetadataRoute.Robots> {
  const settings = await getSiteSettingsPublic();
  const canonicalHost = (settings?.canonicalHost as string) || "";
  const base = canonicalHost || "https://example.com";

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/dashboard", "/api", "/login"],
      },
    ],
    sitemap: base + "/sitemap.xml",
  };
}
