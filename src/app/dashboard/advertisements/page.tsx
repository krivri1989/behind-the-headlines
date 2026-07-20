"use client";

import { AlertCircle, CheckCircle2, Edit2, ExternalLink, Loader2, Megaphone, Plus, Trash2, X, Pin, Image as ImageIcon, Link2, Youtube, FileVideo, BarChart3 } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { AdminGuard } from "@/components/admin-guard";

type Category = { id: string; name: string; slug: string };

type Ad = {
  id: string;
  name: string;
  slot: string;
  size: string;
  type: string;
  mediaUrl: string;
  clickUrl: string;
  rawTag: string;
  youtubeUrl: string;
  youtubeId: string;
  vastUrl: string;
  impressionPixelUrl: string;
  clickTrackingUrl: string;
  scope: string;
  categorySlug: string;
  device: string;
  active: boolean;
  startDate: string | null;
  endDate: string | null;
  priority: number;
  impressions: number;
  clicks: number;
};

type Sponsored = {
  id: string;
  type: string;
  categorySlug: string;
  articleId: string | null;
  title: string;
  imageUrl: string;
  clickUrl: string;
  description: string;
  label: string;
  active: boolean;
  priority: number;
};

type Article = { id: string; title: string; slug: string; status: string };

const SLOT_OPTIONS = [
  { value: "homepage_tri_col_top", label: "Homepage — 3rd Column Top (300x250)" },
  { value: "homepage_sidebar_top", label: "Homepage — Sidebar Top (300x250/600)" },
  { value: "homepage_category_top", label: "Homepage — Above Category Section (728x90)" },
  { value: "category_above_breadcrumb", label: "Category Page — Above Breadcrumb (728x90)" },
  { value: "article_above_breadcrumb", label: "Article Page — Above Breadcrumb (728x90)" },
  { value: "article_related_stories", label: "Article Page — Related Stories Sidebar (300x250)" },
  { value: "interstitial_web", label: "Interstitial — Desktop" },
  { value: "interstitial_mobile", label: "Interstitial — Mobile (320x480)" },
  { value: "video_ad", label: "Video Ad (configurable)" },
];

const SIZE_OPTIONS = ["300x250", "300x600", "728x90", "320x480", "1x1", "video"];

const TYPE_OPTIONS = [
  { value: "direct", label: "Direct (upload image/GIF/MP4 or paste URL)", icon: ImageIcon },
  { value: "third_party", label: "Third-party tag (raw JS/HTML)", icon: BarChart3 },
  { value: "youtube", label: "YouTube video", icon: Youtube },
  { value: "vast", label: "VAST video URL", icon: FileVideo },
  { value: "tracker", label: "1x1 Tracker (invisible pixel)", icon: Link2 },
];

const SCOPE_OPTIONS = [
  { value: "all", label: "ALL (site-wide fallback)" },
  { value: "homepage", label: "Homepage only" },
  { value: "category", label: "Specific category" },
  { value: "article", label: "Article pages" },
];

const DEVICE_OPTIONS = [
  { value: "all", label: "All devices (desktop + mobile/tablet)" },
  { value: "desktop", label: "Desktop only" },
  { value: "mobile", label: "Mobile / tablet only" },
];

function slotLabel(slot: string) {
  return SLOT_OPTIONS.find((s) => s.value === slot)?.label ?? slot;
}

function extractYoutubeId(url: string): string {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : "";
}

export default function AdvertisementsPage() {
  const [tab, setTab] = useState<"ads" | "sponsored">("ads");
  const [ads, setAds] = useState<Ad[]>([]);
  const [sponsored, setSponsored] = useState<Sponsored[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  // Ad form state
  const [adFormOpen, setAdFormOpen] = useState(false);
  const [editingAdId, setEditingAdId] = useState<string | null>(null);
  const [adForm, setAdForm] = useState<Partial<Ad>>({ type: "direct", size: "300x250", slot: "homepage_tri_col_top", scope: "all", device: "all", active: false, priority: 0 });
  const [adErrors, setAdErrors] = useState<Record<string, string>>({});
  const [adSuccess, setAdSuccess] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Sponsored form state
  const [sponsoredFormOpen, setSponsoredFormOpen] = useState(false);
  const [editingSponsoredId, setEditingSponsoredId] = useState<string | null>(null);
  const [sponsoredForm, setSponsoredForm] = useState<Partial<Sponsored>>({ type: "ad_card", active: true, priority: 0, label: "Sponsored" });
  const [sponsoredErrors, setSponsoredErrors] = useState<Record<string, string>>({});
  const [sponsoredSuccess, setSponsoredSuccess] = useState(false);
  const [articleSearch, setArticleSearch] = useState("");
  const [articleResults, setArticleResults] = useState<Article[]>([]);
  const [searchingArticles, setSearchingArticles] = useState(false);

  useEffect(() => {
    Promise.all([
      apiFetch<{ ads: Ad[] }>("/api/ads"),
      apiFetch<{ sponsored: Sponsored[] }>("/api/sponsored"),
      apiFetch<Category[]>("/api/categories"),
    ])
      .then(([adsRes, sponsoredRes, cats]) => {
        setAds(adsRes.ads);
        setSponsored(sponsoredRes.sponsored);
        setCategories(cats);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // --- Ad form helpers ---

  function resetAdForm() {
    setAdForm({ type: "direct", size: "300x250", slot: "homepage_tri_col_top", scope: "all", device: "all", active: false, priority: 0 });
    setAdErrors({});
    setAdSuccess(false);
  }

  function openAddAd() {
    resetAdForm();
    setEditingAdId(null);
    setAdFormOpen(true);
  }

  function openEditAd(ad: Ad) {
    setAdForm({ ...ad });
    setEditingAdId(ad.id);
    setAdErrors({});
    setAdSuccess(false);
    setAdFormOpen(true);
  }

  function closeAdForm() {
    setAdFormOpen(false);
    setEditingAdId(null);
    resetAdForm();
  }

  async function uploadAdFile(file: File) {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/ads/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setAdForm((f) => ({ ...f, mediaUrl: data.url }));
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to upload file");
    } finally {
      setUploading(false);
    }
  }

  function validateAd(): boolean {
    const next: Record<string, string> = {};
    if (!adForm.name?.trim()) next.name = "Ad name is required.";
    if (!adForm.slot) next.slot = "Select a slot.";
    if (!adForm.size) next.size = "Select a size.";
    if (!adForm.type) next.type = "Select a type.";
    if (adForm.type === "direct" && !adForm.mediaUrl?.trim()) next.mediaUrl = "Upload a file or paste a URL.";
    if (adForm.type === "third_party" && !adForm.rawTag?.trim()) next.rawTag = "Paste the third-party ad tag.";
    if (adForm.type === "youtube") {
      if (!adForm.youtubeUrl?.trim()) next.youtubeUrl = "YouTube URL is required.";
      else if (!extractYoutubeId(adForm.youtubeUrl)) next.youtubeUrl = "Enter a valid YouTube URL.";
    }
    if (adForm.type === "vast" && !adForm.vastUrl?.trim()) next.vastUrl = "VAST URL is required.";
    if (adForm.scope === "category" && !adForm.categorySlug) next.categorySlug = "Select a category.";
    if (adForm.clickUrl && adForm.clickUrl.trim()) {
      try { new URL(adForm.clickUrl); } catch { next.clickUrl = "Enter a valid URL."; }
    }
    setAdErrors(next);
    return Object.keys(next).length === 0;
  }

  async function submitAd(event: FormEvent) {
    event.preventDefault();
    if (!validateAd()) return;
    try {
      const payload = { ...adForm };
      if (payload.type === "youtube") payload.youtubeId = extractYoutubeId(payload.youtubeUrl || "");
      if (editingAdId) {
        await apiFetch(`/api/ads/${editingAdId}`, { method: "PUT", body: JSON.stringify(payload) });
        setAds((items) => items.map((a) => a.id === editingAdId ? { ...a, ...payload } as Ad : a));
      } else {
        const created = await apiFetch<Ad>("/api/ads", { method: "POST", body: JSON.stringify(payload) });
        setAds((items) => [created, ...items]);
      }
      setAdSuccess(true);
      setTimeout(() => { setAdFormOpen(false); resetAdForm(); }, 600);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to save ad");
    }
  }

  async function toggleAdActive(id: string) {
    const ad = ads.find((a) => a.id === id);
    if (!ad) return;
    const nextActive = !ad.active;
    setAds((items) => items.map((a) => a.id === id ? { ...a, active: nextActive } : a));
    try { await apiFetch(`/api/ads/${id}`, { method: "PUT", body: JSON.stringify({ active: nextActive }) }); } catch { setAds((items) => items.map((a) => a.id === id ? { ...a, active: ad.active } : a)); }
  }

  async function deleteAd(id: string, name: string) {
    if (!confirm(`Delete ad "${name}"?`)) return;
    try { await apiFetch(`/api/ads/${id}`, { method: "DELETE" }); setAds((items) => items.filter((a) => a.id !== id)); } catch (error) { alert(error instanceof Error ? error.message : "Failed to delete"); }
  }

  // --- Sponsored form helpers ---

  function resetSponsoredForm() {
    setSponsoredForm({ type: "ad_card", active: true, priority: 0, label: "Sponsored" });
    setSponsoredErrors({});
    setSponsoredSuccess(false);
    setArticleSearch("");
    setArticleResults([]);
  }

  function openAddSponsored() {
    resetSponsoredForm();
    setEditingSponsoredId(null);
    setSponsoredFormOpen(true);
  }

  function openEditSponsored(item: Sponsored) {
    setSponsoredForm({ ...item });
    setEditingSponsoredId(item.id);
    setSponsoredErrors({});
    setSponsoredSuccess(false);
    setSponsoredFormOpen(true);
  }

  function closeSponsoredForm() {
    setSponsoredFormOpen(false);
    setEditingSponsoredId(null);
    resetSponsoredForm();
  }

  async function searchArticles(query: string) {
    setArticleSearch(query);
    if (!query.trim()) { setArticleResults([]); return; }
    setSearchingArticles(true);
    try {
      const res = await apiFetch<{ articles: Article[] }>(`/api/articles?search=${encodeURIComponent(query)}&limit=10`);
      setArticleResults(res.articles.filter((a) => a.status === "published"));
    } catch { setArticleResults([]); } finally { setSearchingArticles(false); }
  }

  function validateSponsored(): boolean {
    const next: Record<string, string> = {};
    if (!sponsoredForm.type) next.type = "Select a type.";
    if (!sponsoredForm.categorySlug) next.categorySlug = "Select a category.";
    if (sponsoredForm.type === "article_pin" && !sponsoredForm.articleId) next.articleId = "Select an article to pin.";
    if (sponsoredForm.type === "ad_card") {
      if (!sponsoredForm.title?.trim()) next.title = "Title is required.";
      if (!sponsoredForm.clickUrl?.trim()) next.clickUrl = "Click URL is required.";
    }
    setSponsoredErrors(next);
    return Object.keys(next).length === 0;
  }

  async function submitSponsored(event: FormEvent) {
    event.preventDefault();
    if (!validateSponsored()) return;
    try {
      if (editingSponsoredId) {
        await apiFetch(`/api/sponsored/${editingSponsoredId}`, { method: "PUT", body: JSON.stringify(sponsoredForm) });
        setSponsored((items) => items.map((s) => s.id === editingSponsoredId ? { ...s, ...sponsoredForm } as Sponsored : s));
      } else {
        const created = await apiFetch<Sponsored>("/api/sponsored", { method: "POST", body: JSON.stringify(sponsoredForm) });
        setSponsored((items) => [created, ...items]);
      }
      setSponsoredSuccess(true);
      setTimeout(() => { setSponsoredFormOpen(false); resetSponsoredForm(); }, 600);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to save sponsored content");
    }
  }

  async function toggleSponsoredActive(id: string) {
    const item = sponsored.find((s) => s.id === id);
    if (!item) return;
    const nextActive = !item.active;
    setSponsored((items) => items.map((s) => s.id === id ? { ...s, active: nextActive } : s));
    try { await apiFetch(`/api/sponsored/${id}`, { method: "PUT", body: JSON.stringify({ active: nextActive }) }); } catch { setSponsored((items) => items.map((s) => s.id === id ? { ...s, active: item.active } : s)); }
  }

  async function deleteSponsored(id: string) {
    if (!confirm("Delete this sponsored content?")) return;
    try { await apiFetch(`/api/sponsored/${id}`, { method: "DELETE" }); setSponsored((items) => items.filter((s) => s.id !== id)); } catch (error) { alert(error instanceof Error ? error.message : "Failed to delete"); }
  }

  if (loading) return <main className="app-shell"><div className="dashboard-content"><p className="empty-state">Loading…</p></div></main>;

  return (
    <main className="app-shell">
      <AdminGuard>
      <div className="dashboard-content">
        <div className="page-header">
          <h1><Megaphone size={24} /> Advertisements</h1>
          <p>Manage ad units and sponsored content across the portal.</p>
        </div>

        {/* Tabs */}
        <div className="tab-bar">
          <button className={`tab ${tab === "ads" ? "active" : ""}`} onClick={() => setTab("ads")} type="button">
            <BarChart3 size={16} /> Ad Units ({ads.length})
          </button>
          <button className={`tab ${tab === "sponsored" ? "active" : ""}`} onClick={() => setTab("sponsored")} type="button">
            <Pin size={16} /> Sponsored Content ({sponsored.length})
          </button>
        </div>

        {/* --- Ad Units Tab --- */}
        {tab === "ads" && (
          <div>
            <div className="list-toolbar">
              <button className="btn-primary" onClick={openAddAd} type="button"><Plus size={16} /> New Ad Unit</button>
            </div>

            {ads.length === 0 ? (
              <div className="empty-state">No ad units yet. Click &ldquo;New Ad Unit&rdquo; to create one.</div>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Slot</th>
                      <th>Size</th>
                      <th>Type</th>
                      <th>Scope</th>
                      <th>Device</th>
                      <th>Status</th>
                      <th>Impr.</th>
                      <th>Clicks</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ads.map((ad) => (
                      <tr key={ad.id}>
                        <td><strong>{ad.name}</strong></td>
                        <td>{slotLabel(ad.slot)}</td>
                        <td>{ad.size}</td>
                        <td>{ad.type}</td>
                        <td>{ad.scope === "category" ? `Category: ${ad.categorySlug}` : ad.scope}</td>
                        <td>{ad.device || "all"}</td>
                        <td>
                          <label className="switch-toggle">
                            <input type="checkbox" checked={ad.active} onChange={() => toggleAdActive(ad.id)} />
                            <span className={`switch ${ad.active ? "on" : ""}`} role="switch" aria-checked={ad.active}><span /></span>
                          </label>
                        </td>
                        <td>{ad.impressions}</td>
                        <td>{ad.clicks}</td>
                        <td className="row-actions">
                          <button onClick={() => openEditAd(ad)} title="Edit" type="button"><Edit2 size={14} /></button>
                          <button onClick={() => deleteAd(ad.id, ad.name)} title="Delete" type="button"><Trash2 size={14} /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Ad Form Modal */}
            {adFormOpen && (
              <div className="modal-overlay" onClick={closeAdForm}>
                <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                  <div className="modal-header">
                    <h2>{editingAdId ? "Edit Ad Unit" : "New Ad Unit"}</h2>
                    <button onClick={closeAdForm} type="button" className="modal-close"><X size={20} /></button>
                  </div>
                  <form onSubmit={submitAd} className="modal-form">
                    {adSuccess && <div className="success-banner"><CheckCircle2 size={16} /> Saved successfully!</div>}

                    <label className={adErrors.name ? "field-error" : undefined}>
                      Ad name
                      <input value={adForm.name || ""} onChange={(e) => setAdForm({ ...adForm, name: e.target.value })} placeholder="e.g., Homepage 300x250 — Diwali Campaign" />
                      {adErrors.name && <span className="error-text">{adErrors.name}</span>}
                    </label>

                    <div className="form-row">
                      <label className={adErrors.slot ? "field-error" : undefined}>
                        Slot (placement)
                        <select value={adForm.slot} onChange={(e) => setAdForm({ ...adForm, slot: e.target.value })}>
                          {SLOT_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                        </select>
                        {adErrors.slot && <span className="error-text">{adErrors.slot}</span>}
                      </label>

                      <label className={adErrors.size ? "field-error" : undefined}>
                        Size
                        <select value={adForm.size} onChange={(e) => setAdForm({ ...adForm, size: e.target.value })}>
                          {SIZE_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                        {adErrors.size && <span className="error-text">{adErrors.size}</span>}
                      </label>
                    </div>

                    <label className={adErrors.type ? "field-error" : undefined}>
                      Ad type
                      <select value={adForm.type} onChange={(e) => setAdForm({ ...adForm, type: e.target.value })}>
                        {TYPE_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                      {adErrors.type && <span className="error-text">{adErrors.type}</span>}
                    </label>

                    {/* Type-specific fields */}
                    {adForm.type === "direct" && (
                      <div className="form-section">
                        <label className={adErrors.mediaUrl ? "field-error" : undefined}>
                          Creative (upload file or paste URL)
                          <div className="upload-row">
                            <input value={adForm.mediaUrl || ""} onChange={(e) => setAdForm({ ...adForm, mediaUrl: e.target.value })} placeholder="https://..." />
                            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="btn-secondary">
                              {uploading ? <Loader2 size={14} className="spin" /> : <Plus size={14} />} Upload
                            </button>
                            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif,video/mp4" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadAdFile(f); }} style={{ display: "none" }} />
                          </div>
                          {adErrors.mediaUrl && <span className="error-text">{adErrors.mediaUrl}</span>}
                        </label>
                        <label>
                          Click URL (landing page)
                          <input value={adForm.clickUrl || ""} onChange={(e) => setAdForm({ ...adForm, clickUrl: e.target.value })} placeholder="https://advertiser.com/landing" />
                        </label>
                      </div>
                    )}

                    {adForm.type === "third_party" && (
                      <label className={adErrors.rawTag ? "field-error" : undefined}>
                        Third-party ad tag (raw JS/HTML)
                        <textarea value={adForm.rawTag || ""} onChange={(e) => setAdForm({ ...adForm, rawTag: e.target.value })} rows={8} placeholder="Paste the full ad tag here (e.g., DoubleClick, Flashtalking)..." />
                        {adErrors.rawTag && <span className="error-text">{adErrors.rawTag}</span>}
                      </label>
                    )}

                    {adForm.type === "youtube" && (
                      <label className={adErrors.youtubeUrl ? "field-error" : undefined}>
                        YouTube URL
                        <input value={adForm.youtubeUrl || ""} onChange={(e) => setAdForm({ ...adForm, youtubeUrl: e.target.value })} placeholder="https://www.youtube.com/watch?v=..." />
                        {adErrors.youtubeUrl && <span className="error-text">{adErrors.youtubeUrl}</span>}
                        {adForm.youtubeUrl && extractYoutubeId(adForm.youtubeUrl) && (
                          <img src={`https://img.youtube.com/vi/${extractYoutubeId(adForm.youtubeUrl)}/maxresdefault.jpg`} alt="Thumbnail preview" style={{ marginTop: 8, maxWidth: 200, borderRadius: 4 }} />
                        )}
                      </label>
                    )}

                    {adForm.type === "vast" && (
                      <label className={adErrors.vastUrl ? "field-error" : undefined}>
                        VAST URL
                        <input value={adForm.vastUrl || ""} onChange={(e) => setAdForm({ ...adForm, vastUrl: e.target.value })} placeholder="https://pubads.g.doubleclick.net/gampad/ads?..." />
                        {adErrors.vastUrl && <span className="error-text">{adErrors.vastUrl}</span>}
                      </label>
                    )}

                    {adForm.type === "tracker" && (
                      <div className="form-section">
                        <label>
                          Impression pixel URL
                          <input value={adForm.impressionPixelUrl || ""} onChange={(e) => setAdForm({ ...adForm, impressionPixelUrl: e.target.value })} placeholder="https://..." />
                        </label>
                        <label>
                          Click tracking URL
                          <input value={adForm.clickTrackingUrl || ""} onChange={(e) => setAdForm({ ...adForm, clickTrackingUrl: e.target.value })} placeholder="https://..." />
                        </label>
                      </div>
                    )}

                    {/* Optional tracking for all types (except tracker which has its own) */}
                    {adForm.type !== "tracker" && (
                      <div className="form-section">
                        <label>
                          Impression pixel URL (optional, 1x1 tracking)
                          <input value={adForm.impressionPixelUrl || ""} onChange={(e) => setAdForm({ ...adForm, impressionPixelUrl: e.target.value })} placeholder="https://..." />
                        </label>
                        <label>
                          Click tracking URL (optional, fires on click)
                          <input value={adForm.clickTrackingUrl || ""} onChange={(e) => setAdForm({ ...adForm, clickTrackingUrl: e.target.value })} placeholder="https://..." />
                        </label>
                      </div>
                    )}

                    {/* Targeting */}
                    <div className="form-row">
                      <label className={adErrors.scope ? "field-error" : undefined}>
                        Scope (targeting)
                        <select value={adForm.scope} onChange={(e) => setAdForm({ ...adForm, scope: e.target.value, categorySlug: "" })}>
                          {SCOPE_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                        </select>
                        {adErrors.scope && <span className="error-text">{adErrors.scope}</span>}
                      </label>

                      <label>
                        Device (where to show)
                        <select value={adForm.device || "all"} onChange={(e) => setAdForm({ ...adForm, device: e.target.value })}>
                          {DEVICE_OPTIONS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                        </select>
                      </label>
                    </div>

                    {adForm.scope === "category" && (
                      <label className={adErrors.categorySlug ? "field-error" : undefined}>
                        Category
                        <select value={adForm.categorySlug || ""} onChange={(e) => setAdForm({ ...adForm, categorySlug: e.target.value })}>
                          <option value="">Select category…</option>
                          {categories.map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}
                        </select>
                        {adErrors.categorySlug && <span className="error-text">{adErrors.categorySlug}</span>}
                      </label>
                    )}

                    {/* Scheduling */}
                    <div className="form-row">
                      <label>
                        Start date (optional)
                        <input type="datetime-local" value={adForm.startDate ? new Date(adForm.startDate).toISOString().slice(0, 16) : ""} onChange={(e) => setAdForm({ ...adForm, startDate: e.target.value ? new Date(e.target.value).toISOString() : null })} />
                      </label>
                      <label>
                        End date (optional)
                        <input type="datetime-local" value={adForm.endDate ? new Date(adForm.endDate).toISOString().slice(0, 16) : ""} onChange={(e) => setAdForm({ ...adForm, endDate: e.target.value ? new Date(e.target.value).toISOString() : null })} />
                      </label>
                    </div>

                    <div className="form-row">
                      <label>
                        Priority (higher = preferred when multiple ads match)
                        <input type="number" value={adForm.priority ?? 0} onChange={(e) => setAdForm({ ...adForm, priority: Number(e.target.value) })} />
                      </label>
                      <label className="checkbox-row">
                        <input type="checkbox" checked={adForm.active ?? false} onChange={(e) => setAdForm({ ...adForm, active: e.target.checked })} />
                        <span>Active</span>
                      </label>
                    </div>

                    <div className="form-actions">
                      <button type="button" onClick={closeAdForm} className="btn-secondary">Cancel</button>
                      <button type="submit" className="btn-primary">{editingAdId ? "Update" : "Create"}</button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* --- Sponsored Content Tab --- */}
        {tab === "sponsored" && (
          <div>
            <div className="list-toolbar">
              <button className="btn-primary" onClick={openAddSponsored} type="button"><Plus size={16} /> New Sponsored Content</button>
            </div>

            {sponsored.length === 0 ? (
              <div className="empty-state">No sponsored content yet. Click &ldquo;New Sponsored Content&rdquo; to pin one.</div>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Category</th>
                      <th>Title / Article</th>
                      <th>Label</th>
                      <th>Status</th>
                      <th>Priority</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sponsored.map((item) => (
                      <tr key={item.id}>
                        <td>{item.type === "article_pin" ? "Pin Article" : "Ad Card"}</td>
                        <td>{item.categorySlug}</td>
                        <td>{item.type === "article_pin" ? item.articleId : item.title}</td>
                        <td>{item.label}</td>
                        <td>
                          <label className="switch-toggle">
                            <input type="checkbox" checked={item.active} onChange={() => toggleSponsoredActive(item.id)} />
                            <span className={`switch ${item.active ? "on" : ""}`} role="switch" aria-checked={item.active}><span /></span>
                          </label>
                        </td>
                        <td>{item.priority}</td>
                        <td className="row-actions">
                          <button onClick={() => openEditSponsored(item)} title="Edit" type="button"><Edit2 size={14} /></button>
                          <button onClick={() => deleteSponsored(item.id)} title="Delete" type="button"><Trash2 size={14} /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Sponsored Form Modal */}
            {sponsoredFormOpen && (
              <div className="modal-overlay" onClick={closeSponsoredForm}>
                <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                  <div className="modal-header">
                    <h2>{editingSponsoredId ? "Edit Sponsored Content" : "New Sponsored Content"}</h2>
                    <button onClick={closeSponsoredForm} type="button" className="modal-close"><X size={20} /></button>
                  </div>
                  <form onSubmit={submitSponsored} className="modal-form">
                    {sponsoredSuccess && <div className="success-banner"><CheckCircle2 size={16} /> Saved successfully!</div>}

                    <label className={sponsoredErrors.type ? "field-error" : undefined}>
                      Type
                      <select value={sponsoredForm.type} onChange={(e) => setSponsoredForm({ ...sponsoredForm, type: e.target.value })}>
                        <option value="ad_card">Ad Card (sponsored card with external link)</option>
                        <option value="article_pin">Pin Article (pin a real published article)</option>
                      </select>
                      {sponsoredErrors.type && <span className="error-text">{sponsoredErrors.type}</span>}
                    </label>

                    <label className={sponsoredErrors.categorySlug ? "field-error" : undefined}>
                      Category (which category to pin to)
                      <select value={sponsoredForm.categorySlug || ""} onChange={(e) => setSponsoredForm({ ...sponsoredForm, categorySlug: e.target.value })}>
                        <option value="">Select category…</option>
                        {categories.map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}
                      </select>
                      {sponsoredErrors.categorySlug && <span className="error-text">{sponsoredErrors.categorySlug}</span>}
                    </label>

                    {sponsoredForm.type === "article_pin" && (
                      <div className="form-section">
                        <label className={sponsoredErrors.articleId ? "field-error" : undefined}>
                          Search and select article to pin
                          <input value={articleSearch} onChange={(e) => searchArticles(e.target.value)} placeholder="Search published articles by title…" />
                          {sponsoredErrors.articleId && <span className="error-text">{sponsoredErrors.articleId}</span>}
                        </label>
                        {searchingArticles && <p className="muted"><Loader2 size={14} className="spin" /> Searching…</p>}
                        {articleResults.length > 0 && (
                          <div className="search-results">
                            {articleResults.map((a) => (
                              <button
                                key={a.id}
                                type="button"
                                className={`search-result-item ${sponsoredForm.articleId === a.id ? "selected" : ""}`}
                                onClick={() => { setSponsoredForm({ ...sponsoredForm, articleId: a.id }); setArticleSearch(a.title); setArticleResults([]); }}
                              >
                                {a.title}
                              </button>
                            ))}
                          </div>
                        )}
                        {sponsoredForm.articleId && !articleResults.length && (
                          <p className="muted"><CheckCircle2 size={14} /> Article selected: {articleSearch}</p>
                        )}
                      </div>
                    )}

                    {sponsoredForm.type === "ad_card" && (
                      <div className="form-section">
                        <label className={sponsoredErrors.title ? "field-error" : undefined}>
                          Title
                          <input value={sponsoredForm.title || ""} onChange={(e) => setSponsoredForm({ ...sponsoredForm, title: e.target.value })} placeholder="Sponsored card title" />
                          {sponsoredErrors.title && <span className="error-text">{sponsoredErrors.title}</span>}
                        </label>
                        <label>
                          Image URL
                          <input value={sponsoredForm.imageUrl || ""} onChange={(e) => setSponsoredForm({ ...sponsoredForm, imageUrl: e.target.value })} placeholder="https://..." />
                        </label>
                        <label className={sponsoredErrors.clickUrl ? "field-error" : undefined}>
                          Click URL (landing page)
                          <input value={sponsoredForm.clickUrl || ""} onChange={(e) => setSponsoredForm({ ...sponsoredForm, clickUrl: e.target.value })} placeholder="https://advertiser.com/landing" />
                          {sponsoredErrors.clickUrl && <span className="error-text">{sponsoredErrors.clickUrl}</span>}
                        </label>
                        <label>
                          Description (optional)
                          <textarea value={sponsoredForm.description || ""} onChange={(e) => setSponsoredForm({ ...sponsoredForm, description: e.target.value })} rows={3} placeholder="Short description…" />
                        </label>
                      </div>
                    )}

                    <div className="form-row">
                      <label>
                        Label (shown on card)
                        <input value={sponsoredForm.label || "Sponsored"} onChange={(e) => setSponsoredForm({ ...sponsoredForm, label: e.target.value })} />
                      </label>
                      <label>
                        Priority
                        <input type="number" value={sponsoredForm.priority ?? 0} onChange={(e) => setSponsoredForm({ ...sponsoredForm, priority: Number(e.target.value) })} />
                      </label>
                    </div>

                    <label className="checkbox-row">
                      <input type="checkbox" checked={sponsoredForm.active ?? true} onChange={(e) => setSponsoredForm({ ...sponsoredForm, active: e.target.checked })} />
                      <span>Active</span>
                    </label>

                    <div className="form-actions">
                      <button type="button" onClick={closeSponsoredForm} className="btn-secondary">Cancel</button>
                      <button type="submit" className="btn-primary">{editingSponsoredId ? "Update" : "Create"}</button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      </AdminGuard>
    </main>
  );
}
