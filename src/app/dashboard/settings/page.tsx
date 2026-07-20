"use client";

import { CheckCircle2, Globe2, ImageIcon, Loader2, Megaphone, Palette, Plus, RotateCcw, Save, Settings2, Shield, Trash2, Upload, X, Code2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { AdminGuard } from "@/components/admin-guard";

type Tab = "general" | "seo" | "branding" | "advanced" | "advertising" | "embeds";

type CustomEmbed = {
  name: string;
  position: string;
  html: string;
  active: boolean;
};

type AdPlacement = {
  enabled: boolean;
  allowlist: string;
  scriptUrl: string;
};

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>("general");
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [general, setGeneral] = useState({
    publicationName: "Behind The Headlines",
    tagline: "Independent reporting, analysis, and stories that matter.",
    language: "English",
    timezone: "Asia/Kolkata",
    contactEmail: "",
  });

  const [seo, setSeo] = useState({
    seoTitle: "Behind The Headlines | Independent News",
    metaDescription: "Independent reporting, analysis, and stories that matter.",
    keywords: "news, india, business, technology, world",
    canonicalHost: "",
  });

  const [branding, setBranding] = useState({
    primaryColor: "#4b2739",
    primaryTextColor: "#ffffff",
    accentColor: "#bd8b32",
    accentTextColor: "#ffffff",
    footerColor: "#1a1a1a",
    footerTextColor: "#ffffff",
    logoUrl: "",
    faviconUrl: "",
    defaultImageUrl: "",
  });

  const BRAND_DEFAULTS = {
    primaryColor: "#4b2739",
    primaryTextColor: "#ffffff",
    accentColor: "#bd8b32",
    accentTextColor: "#ffffff",
    footerColor: "#1a1a1a",
    footerTextColor: "#ffffff",
  };

  const [advanced, setAdvanced] = useState({
    rssDefaultAuthor: "RSS Feed",
    articlePageSize: "24",
    enableComments: false,
    cookieConsent: true,
  });

  const [advertising, setAdvertising] = useState({
    globalEnabled: false,
    placements: {
      header: { enabled: false, allowlist: "", scriptUrl: "" } as AdPlacement,
      body: { enabled: false, allowlist: "", scriptUrl: "" } as AdPlacement,
      footer: { enabled: false, allowlist: "", scriptUrl: "" } as AdPlacement,
    },
  });

  const [embeds, setEmbeds] = useState<CustomEmbed[]>([]);

  const [auditPreview, setAuditPreview] = useState<string[]>([]);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingFavicon, setUploadingFavicon] = useState(false);
  const [uploadingDefaultImage, setUploadingDefaultImage] = useState(false);
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const faviconInputRef = useRef<HTMLInputElement | null>(null);
  const defaultImageInputRef = useRef<HTMLInputElement | null>(null);

  async function uploadBrandingImage(file: File, field: "logoUrl" | "faviconUrl" | "defaultImageUrl") {
    const setUploading = field === "logoUrl" ? setUploadingLogo : field === "faviconUrl" ? setUploadingFavicon : setUploadingDefaultImage;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/media", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setBranding((b) => ({ ...b, [field]: data.url }));
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to upload image");
    } finally {
      setUploading(false);
    }
  }

  useEffect(() => {
    apiFetch<Record<string, unknown>>("/api/settings")
      .then((data) => {
        if (data.publicationName) setGeneral((g) => ({ ...g, publicationName: data.publicationName as string, tagline: (data.tagline as string) || g.tagline, language: (data.language as string) || g.language, timezone: (data.timezone as string) || g.timezone, contactEmail: (data.contactEmail as string) || "" }));
        if (data.seoTitle !== undefined) setSeo({ seoTitle: (data.seoTitle as string) || "", metaDescription: (data.metaDescription as string) || "", keywords: (data.keywords as string) || "", canonicalHost: (data.canonicalHost as string) || "" });
        if (data.primaryColor) setBranding({
          primaryColor: (data.primaryColor as string) || "#4b2739",
          primaryTextColor: (data.primaryTextColor as string) || "#ffffff",
          accentColor: (data.accentColor as string) || "#bd8b32",
          accentTextColor: (data.accentTextColor as string) || "#ffffff",
          footerColor: (data.footerColor as string) || "#1a1a1a",
          footerTextColor: (data.footerTextColor as string) || "#ffffff",
          logoUrl: (data.logoUrl as string) || "",
          faviconUrl: (data.faviconUrl as string) || "",
          defaultImageUrl: (data.defaultImageUrl as string) || "",
        });
        if (data.rssDefaultAuthor !== undefined) setAdvanced({ rssDefaultAuthor: (data.rssDefaultAuthor as string) || "RSS Feed", articlePageSize: String(data.articlePageSize ?? 24), enableComments: Boolean(data.enableComments), cookieConsent: Boolean(data.cookieConsent) });
        if (Array.isArray(data.adPlacements)) {
          const placements = data.adPlacements as Array<{ location: string; enabled: boolean; allowlist: string; scriptUrl: string }>;
          setAdvertising({
            globalEnabled: Boolean(data.advertisingEnabled),
            placements: {
              header: { enabled: placements.find((p) => p.location === "header")?.enabled ?? false, allowlist: placements.find((p) => p.location === "header")?.allowlist ?? "", scriptUrl: placements.find((p) => p.location === "header")?.scriptUrl ?? "" },
              body: { enabled: placements.find((p) => p.location === "body")?.enabled ?? false, allowlist: placements.find((p) => p.location === "body")?.allowlist ?? "", scriptUrl: placements.find((p) => p.location === "body")?.scriptUrl ?? "" },
              footer: { enabled: placements.find((p) => p.location === "footer")?.enabled ?? false, allowlist: placements.find((p) => p.location === "footer")?.allowlist ?? "", scriptUrl: placements.find((p) => p.location === "footer")?.scriptUrl ?? "" },
            },
          });
        }
        if (Array.isArray(data.customEmbeds)) {
          setEmbeds(data.customEmbeds as CustomEmbed[]);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!general.publicationName.trim()) next.publicationName = "Publication name is required.";
    if (!general.contactEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(general.contactEmail)) next.contactEmail = "Enter a valid contact email.";
    if (!seo.canonicalHost.trim()) next.canonicalHost = "Canonical host is required.";
    else try { new URL(seo.canonicalHost); } catch { next.canonicalHost = "Enter a valid URL."; }

    if (advertising.globalEnabled) {
      (Object.keys(advertising.placements) as Array<keyof typeof advertising.placements>).forEach((key) => {
        const placement = advertising.placements[key];
        if (placement.enabled) {
          if (placement.scriptUrl.trim() && !/^https:\/\//.test(placement.scriptUrl.trim())) {
            next[`ad-${key}-url`] = "Script URL must use HTTPS.";
          }
          if (!placement.allowlist.trim()) {
            next[`ad-${key}-allowlist`] = "Allowlist is required when a placement is enabled.";
          }
        }
      });
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function save() {
    if (!validate()) return;
    setSaving(true);

    const auditLines: string[] = [];
    if (tab === "advertising") {
      auditLines.push(`Advertising global toggle set to ${advertising.globalEnabled ? "enabled" : "disabled"}`);
      (Object.keys(advertising.placements) as Array<keyof typeof advertising.placements>).forEach((key) => {
        const placement = advertising.placements[key];
        auditLines.push(`${key}: ${placement.enabled ? "enabled" : "disabled"}${placement.enabled ? `, script ${placement.scriptUrl || "—"}` : ""}`);
      });
    }
    setAuditPreview(auditLines);

    const payload: Record<string, unknown> = {
      publicationName: general.publicationName,
      tagline: general.tagline,
      language: general.language,
      timezone: general.timezone,
      contactEmail: general.contactEmail,
      seoTitle: seo.seoTitle,
      metaDescription: seo.metaDescription,
      keywords: seo.keywords,
      canonicalHost: seo.canonicalHost,
      primaryColor: branding.primaryColor,
      primaryTextColor: branding.primaryTextColor,
      accentColor: branding.accentColor,
      accentTextColor: branding.accentTextColor,
      footerColor: branding.footerColor,
      footerTextColor: branding.footerTextColor,
      logoUrl: branding.logoUrl,
      faviconUrl: branding.faviconUrl,
      defaultImageUrl: branding.defaultImageUrl,
      rssDefaultAuthor: advanced.rssDefaultAuthor,
      articlePageSize: Number(advanced.articlePageSize),
      enableComments: advanced.enableComments,
      cookieConsent: advanced.cookieConsent,
      advertisingEnabled: advertising.globalEnabled,
      adPlacements: (Object.keys(advertising.placements) as Array<keyof typeof advertising.placements>).map((key) => ({
        location: key,
        ...advertising.placements[key],
      })),
      customEmbeds: embeds,
    };

    try {
      await apiFetch("/api/settings", { method: "PUT", body: JSON.stringify(payload) });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "general", label: "General", icon: <Settings2 size={15} /> },
    { id: "seo", label: "SEO & Sharing", icon: <Globe2 size={15} /> },
    { id: "branding", label: "Branding", icon: <Palette size={15} /> },
    { id: "advertising", label: "Advertising", icon: <Megaphone size={15} /> },
    { id: "embeds", label: "Custom Embeds", icon: <Code2 size={15} /> },
    { id: "advanced", label: "Advanced", icon: <Shield size={15} /> },
  ];

  return (
    <AdminGuard>
    <main className="workspace-page">
      <header className="workspace-header">
        <div>
          <p className="eyebrow">PORTAL CONFIGURATION</p>
          <h1>Settings</h1>
          <p className="subtitle">Configure publication identity, SEO, branding, and advanced options.</p>
        </div>
        <button className="primary-button" type="button" onClick={save} disabled={saving || loading}>
          {saving ? <Loader2 size={17} className="spinning" /> : saved ? <CheckCircle2 size={17} /> : <Save size={17} />}
          {saved ? "Changes saved" : saving ? "Saving…" : "Save changes"}
        </button>
      </header>

      <div className="settings-tabs">
        {tabs.map((item) => (
          <button key={item.id} className={tab === item.id ? "selected" : ""} onClick={() => { setTab(item.id); setErrors({}); }}>
            {item.icon} {item.label}
          </button>
        ))}
      </div>

      {tab === "general" && (
        <section className="workspace-panel settings-panel">
          <div className="panel-heading"><div><h2>Publication settings</h2><p>Core identity and contact information.</p></div></div>
          <div className="settings-grid">
            <label className={errors.publicationName ? "field-error" : undefined}>
              Publication name
              <input value={general.publicationName} onChange={(event) => setGeneral({ ...general, publicationName: event.target.value })} />
              {errors.publicationName && <span className="error-text">{errors.publicationName}</span>}
            </label>
            <label>
              Tagline
              <input value={general.tagline} onChange={(event) => setGeneral({ ...general, tagline: event.target.value })} />
            </label>
            <label>
              Default language
              <select value={general.language} onChange={(event) => setGeneral({ ...general, language: event.target.value })}>
                <option>English</option>
              </select>
            </label>
            <label>
              Schedule timezone
              <select value={general.timezone} onChange={(event) => setGeneral({ ...general, timezone: event.target.value })}>
                <option value="Asia/Kolkata">Asia/Kolkata</option>
                <option value="UTC">UTC</option>
                <option value="America/New_York">America/New_York</option>
                <option value="Europe/London">Europe/London</option>
              </select>
            </label>
            <label className={errors.contactEmail ? "field-error" : undefined}>
              Contact email
              <input type="email" value={general.contactEmail} onChange={(event) => setGeneral({ ...general, contactEmail: event.target.value })} />
              {errors.contactEmail && <span className="error-text">{errors.contactEmail}</span>}
            </label>
          </div>
        </section>
      )}

      {tab === "seo" && (
        <section className="workspace-panel settings-panel">
          <div className="panel-heading"><div><h2>SEO and sharing</h2><p>Defaults for search results and social sharing.</p></div></div>
          <div className="settings-grid">
            <label>
              Default site title
              <input value={seo.seoTitle} onChange={(event) => setSeo({ ...seo, seoTitle: event.target.value })} />
            </label>
            <label className={errors.canonicalHost ? "field-error" : undefined}>
              Canonical host
              <input value={seo.canonicalHost} onChange={(event) => setSeo({ ...seo, canonicalHost: event.target.value })} placeholder="https://example.com" />
              {errors.canonicalHost && <span className="error-text">{errors.canonicalHost}</span>}
            </label>
            <label className="full-width">
              Default meta description
              <textarea rows={4} value={seo.metaDescription} onChange={(event) => setSeo({ ...seo, metaDescription: event.target.value })} />
            </label>
            <label className="full-width">
              Default keywords
              <input value={seo.keywords} onChange={(event) => setSeo({ ...seo, keywords: event.target.value })} />
            </label>
          </div>
        </section>
      )}

      {tab === "branding" && (
        <section className="workspace-panel settings-panel">
          <div className="panel-heading"><div><h2>Branding</h2><p>Customize the colors shown on the public website. Each section lets you set both a background and a text color so text stays readable.</p></div></div>
          <div className="settings-grid">
            <label>
              Header bar — background
              <div className="color-field">
                <input type="color" value={branding.primaryColor} onChange={(event) => setBranding({ ...branding, primaryColor: event.target.value })} />
                <input value={branding.primaryColor} onChange={(event) => setBranding({ ...branding, primaryColor: event.target.value })} />
                {branding.primaryColor !== BRAND_DEFAULTS.primaryColor && (
                  <button type="button" className="color-reset" title="Reset to default" onClick={() => setBranding({ ...branding, primaryColor: BRAND_DEFAULTS.primaryColor })}><RotateCcw size={14} /></button>
                )}
              </div>
              <small className="color-hint">Top header strip (edition, date, weather, social icons)</small>
            </label>
            <label>
              Header bar — text color
              <div className="color-field">
                <input type="color" value={branding.primaryTextColor} onChange={(event) => setBranding({ ...branding, primaryTextColor: event.target.value })} />
                <input value={branding.primaryTextColor} onChange={(event) => setBranding({ ...branding, primaryTextColor: event.target.value })} />
                {branding.primaryTextColor !== BRAND_DEFAULTS.primaryTextColor && (
                  <button type="button" className="color-reset" title="Reset to default" onClick={() => setBranding({ ...branding, primaryTextColor: BRAND_DEFAULTS.primaryTextColor })}><RotateCcw size={14} /></button>
                )}
              </div>
              <small className="color-hint">Text shown on the top header strip</small>
            </label>
            <label>
              Accent — background
              <div className="color-field">
                <input type="color" value={branding.accentColor} onChange={(event) => setBranding({ ...branding, accentColor: event.target.value })} />
                <input value={branding.accentColor} onChange={(event) => setBranding({ ...branding, accentColor: event.target.value })} />
                {branding.accentColor !== BRAND_DEFAULTS.accentColor && (
                  <button type="button" className="color-reset" title="Reset to default" onClick={() => setBranding({ ...branding, accentColor: BRAND_DEFAULTS.accentColor })}><RotateCcw size={14} /></button>
                )}
              </div>
              <small className="color-hint">Line under the menu &amp; breaking news bar background</small>
            </label>
            <label>
              Accent — text color
              <div className="color-field">
                <input type="color" value={branding.accentTextColor} onChange={(event) => setBranding({ ...branding, accentTextColor: event.target.value })} />
                <input value={branding.accentTextColor} onChange={(event) => setBranding({ ...branding, accentTextColor: event.target.value })} />
                {branding.accentTextColor !== BRAND_DEFAULTS.accentTextColor && (
                  <button type="button" className="color-reset" title="Reset to default" onClick={() => setBranding({ ...branding, accentTextColor: BRAND_DEFAULTS.accentTextColor })}><RotateCcw size={14} /></button>
                )}
              </div>
              <small className="color-hint">Text shown on the breaking news bar</small>
            </label>
            <label>
              Footer — background
              <div className="color-field">
                <input type="color" value={branding.footerColor} onChange={(event) => setBranding({ ...branding, footerColor: event.target.value })} />
                <input value={branding.footerColor} onChange={(event) => setBranding({ ...branding, footerColor: event.target.value })} />
                {branding.footerColor !== BRAND_DEFAULTS.footerColor && (
                  <button type="button" className="color-reset" title="Reset to default" onClick={() => setBranding({ ...branding, footerColor: BRAND_DEFAULTS.footerColor })}><RotateCcw size={14} /></button>
                )}
              </div>
              <small className="color-hint">Footer section background (subscriber form, links, copyright)</small>
            </label>
            <label>
              Footer — text color
              <div className="color-field">
                <input type="color" value={branding.footerTextColor} onChange={(event) => setBranding({ ...branding, footerTextColor: event.target.value })} />
                <input value={branding.footerTextColor} onChange={(event) => setBranding({ ...branding, footerTextColor: event.target.value })} />
                {branding.footerTextColor !== BRAND_DEFAULTS.footerTextColor && (
                  <button type="button" className="color-reset" title="Reset to default" onClick={() => setBranding({ ...branding, footerTextColor: BRAND_DEFAULTS.footerTextColor })}><RotateCcw size={14} /></button>
                )}
              </div>
              <small className="color-hint">Text shown in the footer section</small>
            </label>
            <label className="full-width">
              Logo image
              <div className="branding-upload">
                {branding.logoUrl ? (
                  <div className="branding-preview">
                    <img src={branding.logoUrl} alt="Logo preview" />
                    <div className="branding-preview-actions">
                      <button type="button" className="secondary-button" onClick={() => logoInputRef.current?.click()} disabled={uploadingLogo}>
                        {uploadingLogo ? <Loader2 size={14} className="spinning" /> : <Upload size={14} />} Replace
                      </button>
                      <button type="button" className="color-reset" title="Remove logo" onClick={() => setBranding({ ...branding, logoUrl: "" })}><X size={14} /></button>
                    </div>
                  </div>
                ) : (
                  <button type="button" className="branding-dropzone" onClick={() => logoInputRef.current?.click()} disabled={uploadingLogo}>
                    {uploadingLogo ? <Loader2 size={20} className="spinning" /> : <ImageIcon size={24} />}
                    <span>{uploadingLogo ? "Uploading…" : "Click to upload logo"}</span>
                  </button>
                )}
                <input ref={logoInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(event) => { const file = event.target.files?.[0]; if (file) uploadBrandingImage(file, "logoUrl"); event.target.value = ""; }} />
              </div>
              <small className="color-hint">Shown in the header and footer (PNG, JPG, WebP — recommended height 52px)</small>
            </label>
            <label className="full-width">
              Favicon image
              <div className="branding-upload">
                {branding.faviconUrl ? (
                  <div className="branding-preview">
                    <img src={branding.faviconUrl} alt="Favicon preview" className="favicon-preview-img" />
                    <div className="branding-preview-actions">
                      <button type="button" className="secondary-button" onClick={() => faviconInputRef.current?.click()} disabled={uploadingFavicon}>
                        {uploadingFavicon ? <Loader2 size={14} className="spinning" /> : <Upload size={14} />} Replace
                      </button>
                      <button type="button" className="color-reset" title="Remove favicon" onClick={() => setBranding({ ...branding, faviconUrl: "" })}><X size={14} /></button>
                    </div>
                  </div>
                ) : (
                  <button type="button" className="branding-dropzone" onClick={() => faviconInputRef.current?.click()} disabled={uploadingFavicon}>
                    {uploadingFavicon ? <Loader2 size={20} className="spinning" /> : <ImageIcon size={24} />}
                    <span>{uploadingFavicon ? "Uploading…" : "Click to upload favicon"}</span>
                  </button>
                )}
                <input ref={faviconInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(event) => { const file = event.target.files?.[0]; if (file) uploadBrandingImage(file, "faviconUrl"); event.target.value = ""; }} />
              </div>
              <small className="color-hint">Shown in the browser tab (square PNG or ICO — recommended 32×32 or 64×64)</small>
            </label>
            <label className="full-width">
              Default article image
              <div className="branding-upload">
                {branding.defaultImageUrl ? (
                  <div className="branding-preview">
                    <img src={branding.defaultImageUrl} alt="Default article image preview" />
                    <div className="branding-preview-actions">
                      <button type="button" className="secondary-button" onClick={() => defaultImageInputRef.current?.click()} disabled={uploadingDefaultImage}>
                        {uploadingDefaultImage ? <Loader2 size={14} className="spinning" /> : <Upload size={14} />} Replace
                      </button>
                      <button type="button" className="color-reset" title="Remove default image" onClick={() => setBranding({ ...branding, defaultImageUrl: "" })}><X size={14} /></button>
                    </div>
                  </div>
                ) : (
                  <button type="button" className="branding-dropzone" onClick={() => defaultImageInputRef.current?.click()} disabled={uploadingDefaultImage}>
                    {uploadingDefaultImage ? <Loader2 size={20} className="spinning" /> : <ImageIcon size={24} />}
                    <span>{uploadingDefaultImage ? "Uploading…" : "Click to upload default article image"}</span>
                  </button>
                )}
                <input ref={defaultImageInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(event) => { const file = event.target.files?.[0]; if (file) uploadBrandingImage(file, "defaultImageUrl"); event.target.value = ""; }} />
              </div>
              <small className="color-hint">Shown when an article has no featured image (any aspect ratio, landscape preferred)</small>
            </label>
          </div>
        </section>
      )}

      {tab === "advanced" && (
        <section className="workspace-panel settings-panel">
          <div className="panel-heading"><div><h2>Advanced</h2><p>Editorial defaults and feature toggles.</p></div></div>
          <div className="settings-grid">
            <label>
              RSS default author name
              <input value={advanced.rssDefaultAuthor} onChange={(event) => setAdvanced({ ...advanced, rssDefaultAuthor: event.target.value })} />
            </label>
            <label>
              Articles per page
              <input type="number" min={6} max={100} value={advanced.articlePageSize} onChange={(event) => setAdvanced({ ...advanced, articlePageSize: event.target.value })} />
            </label>
            <label className="checkbox-row">
              <input type="checkbox" checked={advanced.enableComments} onChange={(event) => setAdvanced({ ...advanced, enableComments: event.target.checked })} />
              <span>Enable comments (placeholder)</span>
            </label>
            <label className="checkbox-row">
              <input type="checkbox" checked={advanced.cookieConsent} onChange={(event) => setAdvanced({ ...advanced, cookieConsent: event.target.checked })} />
              <span>Show cookie consent banner</span>
            </label>
          </div>
        </section>
      )}

      {tab === "advertising" && (
        <section className="workspace-panel settings-panel">
          <div className="panel-heading"><div><h2>Advertising placements</h2><p>Admin-only configuration. Scripts are not rendered on public pages until explicitly enabled.</p></div></div>
          <label className="checkbox-row ad-global-toggle">
            <input type="checkbox" checked={advertising.globalEnabled} onChange={(event) => setAdvertising({ ...advertising, globalEnabled: event.target.checked })} />
            <span>Enable advertising placements globally</span>
          </label>

          <div className="ad-placements">
            {(Object.keys(advertising.placements) as Array<keyof typeof advertising.placements>).map((key) => {
              const placement = advertising.placements[key];
              return (
                <article className={`ad-placement-card ${placement.enabled ? "enabled" : ""}`} key={key}>
                  <div className="ad-placement-header">
                    <div>
                      <strong><Megaphone size={14} /> {key.charAt(0).toUpperCase() + key.slice(1)}</strong>
                      <span>Reserved {key} placement slot</span>
                    </div>
                    <label className="switch-toggle">
                      <input type="checkbox" checked={placement.enabled} onChange={(event) => setAdvertising({ ...advertising, placements: { ...advertising.placements, [key]: { ...placement, enabled: event.target.checked } } })} />
                      <span className={`switch ${placement.enabled ? "on" : ""}`} role="switch" aria-checked={placement.enabled}><span /></span>
                    </label>
                  </div>
                  <label className={errors[`ad-${key}-allowlist`] ? "field-error" : undefined}>
                    Allowed domain / script allowlist
                    <input value={placement.allowlist} onChange={(event) => setAdvertising({ ...advertising, placements: { ...advertising.placements, [key]: { ...placement, allowlist: event.target.value } } })} placeholder="e.g. ad-provider.example.com" />
                    {errors[`ad-${key}-allowlist`] && <span className="error-text">{errors[`ad-${key}-allowlist`]}</span>}
                  </label>
                  <label className={errors[`ad-${key}-url`] ? "field-error" : undefined}>
                    External script URL (HTTPS only)
                    <input type="url" value={placement.scriptUrl} onChange={(event) => setAdvertising({ ...advertising, placements: { ...advertising.placements, [key]: { ...placement, scriptUrl: event.target.value } } })} placeholder="https://..." />
                    {errors[`ad-${key}-url`] && <span className="error-text">{errors[`ad-${key}-url`]}</span>}
                  </label>
                </article>
              );
            })}
          </div>

          {auditPreview.length > 0 && (
            <div className="ad-audit-preview">
              <strong>Audit preview</strong>
              <ul>{auditPreview.map((line, index) => <li key={index}>{line}</li>)}</ul>
            </div>
          )}
        </section>
      )}

      {tab === "embeds" && (
        <section className="workspace-panel settings-panel">
          <h2>Custom Embeds</h2>
          <p className="settings-hint">Add custom scripts, widgets, or third-party embeds (e.g., TradingView ticker tape, social widgets) to specific positions on every public page. Paste the full HTML snippet including any &lt;script&gt; tags.</p>

          <div className="embeds-list">
            {embeds.length === 0 && (
              <p className="empty-state">No custom embeds yet. Click &ldquo;Add Embed&rdquo; to create one.</p>
            )}

            {embeds.map((embed, index) => (
              <article key={index} className="embed-card">
                <div className="embed-card-header">
                  <input
                    className="embed-name-input"
                    value={embed.name}
                    onChange={(e) => setEmbeds(embeds.map((em, i) => i === index ? { ...em, name: e.target.value } : em))}
                    placeholder="Embed name (e.g., Sensex/Nifty Ticker)"
                  />
                  <select
                    className="embed-position-select"
                    value={embed.position}
                    onChange={(e) => setEmbeds(embeds.map((em, i) => i === index ? { ...em, position: e.target.value } : em))}
                  >
                    <option value="head">Head (top of page)</option>
                    <option value="body_top">Body Top (above header)</option>
                    <option value="homepage_below_tri_col">Homepage — Below 3rd Column (after ad)</option>
                    <option value="footer_top">Footer Top (above footer)</option>
                    <option value="body_bottom">Body Bottom (below footer)</option>
                  </select>
                  <label className="embed-active-toggle">
                    <input type="checkbox" checked={embed.active} onChange={(e) => setEmbeds(embeds.map((em, i) => i === index ? { ...em, active: e.target.checked } : em))} />
                    <span>{embed.active ? "Active" : "Inactive"}</span>
                  </label>
                  <button type="button" className="embed-delete-btn" onClick={() => setEmbeds(embeds.filter((_, i) => i !== index))} title="Remove embed">
                    <Trash2 size={14} />
                  </button>
                </div>
                <textarea
                  className="embed-html-textarea"
                  value={embed.html}
                  onChange={(e) => setEmbeds(embeds.map((em, i) => i === index ? { ...em, html: e.target.value } : em))}
                  rows={6}
                  placeholder={'Paste HTML/script here, e.g.,\n<script type="module" src="https://widgets.tradingview-widget.com/w/en/tv-ticker-tape.js"></script>\n<tv-ticker-tape symbols="NSE:NIFTY,BSE:SENSEX"></tv-ticker-tape>'}
                  spellCheck={false}
                />
              </article>
            ))}
          </div>

          <button type="button" className="secondary-button embed-add-btn" onClick={() => setEmbeds([...embeds, { name: "", position: "body_top", html: "", active: false }])}>
            <Plus size={15} /> Add Embed
          </button>

          <div className="embed-example">
            <strong>Example — TradingView Sensex/Nifty Ticker:</strong>
            <pre>{`<script type="module" src="https://widgets.tradingview-widget.com/w/en/tv-ticker-tape.js"></script>
<tv-ticker-tape symbols="NSE:NIFTY,BSE:SENSEX"></tv-ticker-tape>`}</pre>
            <p className="settings-hint">Set position to &ldquo;Body Top&rdquo; to show it above the header on every page.</p>
          </div>
        </section>
      )}
    </main>
    </AdminGuard>
  );
}
