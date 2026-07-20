import { ReactNode } from "react";
import { getSiteSettingsPublic, getVisibleCategories, getPublicMenu, getInterstitialAd } from "@/lib/public-data";
import { PublicHeader } from "@/components/public-header";
import { PublicFooter } from "@/components/public-footer";
import { CookieConsent } from "@/components/cookie-consent";
import { SiteSettingsProvider } from "@/components/site-settings-provider";
import { InterstitialAd } from "@/components/interstitial-ad";
import { CustomEmbedsForPosition } from "@/components/custom-embeds";
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
  const faviconUrl = (settings?.faviconUrl as string) || "";

  return {
    title: { default: seoTitle, template: "%s | " + name },
    description: metaDescription,
    keywords: keywords,
    metadataBase: canonicalHost ? new URL(canonicalHost) : undefined,
    icons: faviconUrl ? { icon: [{ url: faviconUrl }], shortcut: [{ url: faviconUrl }], apple: [{ url: faviconUrl }] } : undefined,
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
  const [settings, categories, headerMenu, footerMenu, interstitialWeb, interstitialMobile] = await Promise.all([
    getSiteSettingsPublic(),
    getVisibleCategories(),
    getPublicMenu("header"),
    getPublicMenu("footer"),
    getInterstitialAd(false),
    getInterstitialAd(true),
  ]);

  const primaryColor = (settings?.primaryColor as string) || "#4b2739";
  const primaryTextColor = (settings?.primaryTextColor as string) || "#ffffff";
  const accentColor = (settings?.accentColor as string) || "#bd8b32";
  const accentTextColor = (settings?.accentTextColor as string) || "#ffffff";
  const footerColor = (settings?.footerColor as string) || "#1a1a1a";
  const footerTextColor = (settings?.footerTextColor as string) || "#ffffff";
  const cookieConsent = settings?.cookieConsent !== false;
  const customEmbeds = ((settings?.customEmbeds as Array<Record<string, unknown>>) || []).map((e) => ({
    name: String(e.name || ""),
    position: String(e.position || ""),
    html: String(e.html || ""),
    active: Boolean(e.active),
  }));

  return (
    <div className="public-body" style={{
      "--pub-topbar-bg": primaryColor,
      "--pub-topbar-text": primaryTextColor,
      "--pub-accent": accentColor,
      "--pub-accent-text": accentTextColor,
      "--pub-footer-bg": footerColor,
      "--pub-footer-text": footerTextColor,
    } as React.CSSProperties}>
      {/* Custom embeds — head (rendered at top of body, scripts load fine) */}
      <CustomEmbedsForPosition embeds={customEmbeds} position="head" />

      {/* Custom embeds — body_top (e.g., Sensex/Nifty ticker tape) */}
      <CustomEmbedsForPosition embeds={customEmbeds} position="body_top" />

      <PublicHeader
        settings={settings}
        categories={categories}
        menuItems={headerMenu}
      />
      <main className="public-main">
        <SiteSettingsProvider settings={settings}>{children}</SiteSettingsProvider>
      </main>
      <PublicFooter
        settings={settings}
        categories={categories}
        menuItems={footerMenu}
      />

      {/* Custom embeds — footer_top */}
      <CustomEmbedsForPosition embeds={customEmbeds} position="footer_top" />

      {/* Custom embeds — body_bottom */}
      <CustomEmbedsForPosition embeds={customEmbeds} position="body_bottom" />

      <CookieConsent enabled={cookieConsent} />
      <InterstitialAd webAd={interstitialWeb} mobileAd={interstitialMobile} />
    </div>
  );
}
