"use client";

import { createContext, useContext, ReactNode } from "react";

type SiteSettings = {
  publicationName?: string;
  tagline?: string;
  language?: string;
  timezone?: string;
  contactEmail?: string;
  seoTitle?: string;
  metaDescription?: string;
  keywords?: string;
  canonicalHost?: string;
  primaryColor?: string;
  primaryTextColor?: string;
  accentColor?: string;
  accentTextColor?: string;
  footerColor?: string;
  footerTextColor?: string;
  logoUrl?: string;
  faviconUrl?: string;
  defaultImageUrl?: string;
  rssDefaultAuthor?: string;
  articlePageSize?: number;
  enableComments?: boolean;
  cookieConsent?: boolean;
  advertisingEnabled?: boolean;
};

const SiteSettingsContext = createContext<SiteSettings>({});

export function SiteSettingsProvider({ children, settings }: { children: ReactNode; settings?: Record<string, unknown> }) {
  return <SiteSettingsContext.Provider value={(settings as SiteSettings) || {}}>{children}</SiteSettingsContext.Provider>;
}

export function useSiteSettings() {
  return useContext(SiteSettingsContext);
}
