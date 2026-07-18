import { ReactNode } from "react";
import { getSiteSettingsPublic, getVisibleCategories, getPublicMenu } from "@/lib/public-data";
import { PublicHeader } from "@/components/public-header";
import { PublicFooter } from "@/components/public-footer";
import "./public.css";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const settings = await getSiteSettingsPublic();
  const name = (settings?.publicationName as string) || "Behind The Headlines";
  const tagline = (settings?.tagline as string) || "Independent reporting, analysis, and stories that matter.";
  const canonicalHost = (settings?.canonicalHost as string) || "";
  const seoTitle = (settings?.seoTitle as string) || name;
  const metaDescription = (settings?.metaDescription as string) || tagline;
  const keywords = (settings?.keywords as string) || "";

  return {
    title: { default: seoTitle, template: "%s | " + name },
    description: metaDescription,
    keywords: keywords,
    metadataBase: canonicalHost ? new URL(canonicalHost) : undefined,
    openGraph: {
      type: "website",
      siteName: name,
      title: seoTitle,
      description: metaDescription,
    },
    twitter: { card: "summary_large_image" },
    robots: { index: true, follow: true },
  };
}

export default async function PublicLayout({ children }: { children: ReactNode }) {
  const [settings, categories, headerMenu, footerMenu] = await Promise.all([
    getSiteSettingsPublic(),
    getVisibleCategories(),
    getPublicMenu("header"),
    getPublicMenu("footer"),
  ]);

  return (
    <div className="public-body">
      <PublicHeader
        settings={settings}
        categories={categories}
        menuItems={headerMenu}
      />
      <main className="public-main">{children}</main>
      <PublicFooter
        settings={settings}
        categories={categories}
        menuItems={footerMenu}
      />
    </div>
  );
}
