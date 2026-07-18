"use client";

import { AlertCircle, CheckCircle2, ChevronDown, Clock, Download, Edit2, ExternalLink, Loader2, Pause, Play, Plus, Radio, RefreshCw, Trash2, X } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api-client";

type Category = { id: string; name: string };
type RssSource = { id: string; name: string; feedUrl: string; category: string; categoryId?: string; intervalMinutes: number; active: boolean; lastRunAt: string | null; nextRunAt: string | null; lastError: string | null; lastImportedCount: number | null };
type FeedItem = { title: string; link: string; publishedAt: string; summary: string; imageUrl: string };

type ImportResult = {
  sourceId: string;
  sourceName: string;
  status: "success" | "partial" | "failed";
  importedCount: number;
  skippedCount: number;
  error?: string;
  articles: { id: string; title: string; slug: string }[];
};

type FetchAllResult = {
  results: ImportResult[];
  summary: { totalSources: number; totalImported: number; totalSkipped: number; failedCount: number };
};

const INTERVAL_OPTIONS = [{ value: 15, label: "Every 15 minutes" }, { value: 30, label: "Every 30 minutes" }, { value: 45, label: "Every 45 minutes" }, { value: 60, label: "Every 1 hour" }, { value: 120, label: "Every 2 hours" }, { value: 180, label: "Every 3 hours" }, { value: 300, label: "Every 5 hours" }, { value: 600, label: "Every 10 hours" }, { value: 1440, label: "Every 1 day" }];

function healthFor(source: RssSource) {
  if (!source.active) return { status: "paused" as const, label: "Paused", dot: "paused" };
  if (source.lastError) return { status: "error" as const, label: "Error", dot: "error" };
  if (!source.lastRunAt) return { status: "warning" as const, label: "Waiting", dot: "warning" };
  return { status: "good" as const, label: "Healthy", dot: "good" };
}

function formatInterval(minutes: number) {
  return INTERVAL_OPTIONS.find((item) => item.value === minutes)?.label ?? `${minutes} minutes`;
}

function stripHtml(html: string) {
  return html.replace(/<[^>]*>/g, "");
}

export default function RssSourcesPage() {
  const [sources, setSources] = useState<RssSource[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [feedUrl, setFeedUrl] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [intervalMinutes, setIntervalMinutes] = useState(30);
  const [active, setActive] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [previewSource, setPreviewSource] = useState<RssSource | null>(null);
  const [previewItems, setPreviewItems] = useState<FeedItem[]>([]);
  const [previewTitle, setPreviewTitle] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [fetchingId, setFetchingId] = useState<string | null>(null);
  const [fetchingAll, setFetchingAll] = useState(false);
  const [importResults, setImportResults] = useState<ImportResult[] | null>(null);
  const [fetchAllSummary, setFetchAllSummary] = useState<FetchAllResult["summary"] | null>(null);

  async function refreshSources() {
    try {
      const srcs = await apiFetch<RssSource[]>("/api/rss-sources");
      setSources(srcs);
    } catch { /* ignore */ }
  }

  useEffect(() => {
    Promise.all([apiFetch<RssSource[]>("/api/rss-sources"), apiFetch<Category[]>("/api/categories")])
      .then(([srcs, cats]) => { setSources(srcs); setCategories(cats); if (cats[0]) setCategoryId(cats[0].id); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const activeCount = useMemo(() => sources.filter((s) => s.active && !s.lastError).length, [sources]);
  const errorCount = useMemo(() => sources.filter((s) => s.active && s.lastError).length, [sources]);

  function resetForm() { setName(""); setFeedUrl(""); setCategoryId(categories[0]?.id || ""); setIntervalMinutes(30); setActive(true); setErrors({}); setSaveSuccess(false); }
  function openAdd() { resetForm(); setEditingId(null); setFormOpen(true); }
  function openEdit(source: RssSource) { setName(source.name); setFeedUrl(source.feedUrl); setCategoryId(source.categoryId || categories[0]?.id || ""); setIntervalMinutes(source.intervalMinutes); setActive(source.active); setEditingId(source.id); setErrors({}); setSaveSuccess(false); setFormOpen(true); }
  function closeForm() { setFormOpen(false); setEditingId(null); resetForm(); }

  function validate() {
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = "Source name is required.";
    if (!feedUrl.trim()) next.feedUrl = "Feed URL is required.";
    else try { const url = new URL(feedUrl); if (!/^https?:$/.test(url.protocol)) next.feedUrl = "URL must use http or https."; } catch { next.feedUrl = "Enter a valid URL."; }
    if (!categoryId) next.category = "Select a category.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!validate()) return;
    try {
      if (editingId) {
        await apiFetch("/api/rss-sources", { method: "PUT", body: JSON.stringify({ id: editingId, name, feedUrl, categoryId, intervalMinutes, active }) });
        setSources((items) => items.map((s) => s.id === editingId ? { ...s, name, feedUrl, category: categories.find((c) => c.id === categoryId)?.name || s.category, intervalMinutes, active } : s));
      } else {
        const source = await apiFetch<RssSource>("/api/rss-sources", { method: "POST", body: JSON.stringify({ name, feedUrl, categoryId, intervalMinutes, active }) });
        setSources((items) => [...items, { ...source, category: categories.find((c) => c.id === categoryId)?.name || "Uncategorized" }]);
      }
      setSaveSuccess(true);
      setTimeout(() => { setFormOpen(false); resetForm(); }, 600);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to save source");
    }
  }

  async function toggleActive(id: string) {
    const source = sources.find((s) => s.id === id);
    if (!source) return;
    const nextActive = !source.active;
    setSources((items) => items.map((s) => s.id === id ? { ...s, active: nextActive } : s));
    try { await apiFetch("/api/rss-sources", { method: "PUT", body: JSON.stringify({ id, active: nextActive }) }); } catch { setSources((items) => items.map((s) => s.id === id ? { ...s, active: source.active } : s)); }
  }

  async function removeSource(id: string, name: string) {
    if (!confirm(`Remove RSS source "${name}"?`)) return;
    try { await apiFetch("/api/rss-sources", { method: "DELETE", body: JSON.stringify({ id }) }); setSources((items) => items.filter((s) => s.id !== id)); if (previewSource?.id === id) clearPreview(); } catch (error) { alert(error instanceof Error ? error.message : "Failed to delete"); }
  }

  async function preview(source: RssSource) {
    setPreviewSource(source); setPreviewLoading(true); setPreviewError(""); setPreviewItems([]); setPreviewTitle("");
    try {
      const response = await fetch("/api/rss/preview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ feedUrl: source.feedUrl }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setPreviewTitle(body.title); setPreviewItems(body.items);
    } catch (reason) { setPreviewError(reason instanceof Error ? reason.message : "Unable to fetch the feed."); } finally { setPreviewLoading(false); }
  }

  function clearPreview() { setPreviewSource(null); setPreviewItems([]); setPreviewTitle(""); setPreviewError(""); }

  async function fetchSource(source: RssSource) {
    setFetchingId(source.id);
    setImportResults(null);
    setFetchAllSummary(null);
    try {
      const result = await apiFetch<ImportResult>(`/api/rss-sources/${source.id}/fetch`, { method: "POST" });
      setImportResults([result]);
      await refreshSources();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to fetch source");
    } finally {
      setFetchingId(null);
    }
  }

  async function fetchAll() {
    setFetchingAll(true);
    setImportResults(null);
    setFetchAllSummary(null);
    try {
      const result = await apiFetch<FetchAllResult>("/api/rss-sources/fetch-all", { method: "POST" });
      setImportResults(result.results);
      setFetchAllSummary(result.summary);
      await refreshSources();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to fetch all sources");
    } finally {
      setFetchingAll(false);
    }
  }

  return (
    <main className="workspace-page">
      <header className="workspace-header">
        <div><p className="eyebrow">AUTOMATED CONTENT</p><h1>RSS sources</h1><p className="subtitle">Manage licensed feeds, schedules, and import health.</p></div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="secondary-button" type="button" onClick={fetchAll} disabled={fetchingAll || activeCount === 0}>
            {fetchingAll ? <Loader2 size={18} className="spinning" /> : <Download size={18} />} {fetchingAll ? "Fetching all…" : "Fetch All"}
          </button>
          <button className="primary-button" type="button" onClick={openAdd}><Plus size={18} /> Add RSS source</button>
        </div>
      </header>

      <section className="metrics rss-metrics">
        <article className="metric-card"><span className="metric-icon green"><Radio size={18} /></span><p>Active sources</p><strong>{activeCount}</strong></article>
        <article className="metric-card"><span className="metric-icon plum"><AlertCircle size={18} /></span><p>Import failures</p><strong>{errorCount}</strong></article>
        <article className="metric-card"><span className="metric-icon gold"><RefreshCw size={18} /></span><p>Total sources</p><strong>{sources.length}</strong></article>
      </section>

      {formOpen && (
        <section className="workspace-panel rss-form-panel">
          <div className="panel-heading"><div><h2>{editingId ? "Edit RSS source" : "Add RSS source"}</h2><p>{editingId ? "Update the feed configuration." : "Configure a new feed."}</p></div><button className="more-button" type="button" onClick={closeForm}><X size={18} /></button></div>
          <form onSubmit={submit} className="rss-source-form">
            <label className={errors.name ? "field-error" : undefined}>Source name<input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Reuters India" />{errors.name && <span className="error-text">{errors.name}</span>}</label>
            <label className={errors.feedUrl ? "field-error" : undefined}>Feed URL<input type="url" value={feedUrl} onChange={(event) => setFeedUrl(event.target.value)} placeholder="https://example.com/feed.xml" />{errors.feedUrl && <span className="error-text">{errors.feedUrl}</span>}</label>
            <label>Category<div className="select-wrapper"><select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select><ChevronDown size={14} /></div></label>
            <label>Fetch interval<div className="select-wrapper"><select value={intervalMinutes} onChange={(event) => setIntervalMinutes(Number(event.target.value))}>{INTERVAL_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select><ChevronDown size={14} /></div></label>
            <label className="checkbox-row"><input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} /><span>Active</span></label>
            <div className="form-actions"><button className="secondary-button" type="button" onClick={closeForm}>Cancel</button><button className="primary-button" type="submit">{saveSuccess ? <CheckCircle2 size={17} /> : null}{saveSuccess ? "Saved" : editingId ? "Update" : "Save"}</button></div>
          </form>
        </section>
      )}

      <section className="workspace-panel source-list-panel">
        <div className="panel-heading"><div><h2>Configured sources</h2><p>{sources.length} source{sources.length === 1 ? "" : "s"}.</p></div></div>
        {loading ? <div className="empty-state">Loading…</div> : sources.length === 0 ? <div className="empty-state">No RSS sources configured. Add one to start importing content.</div> : (
          <div className="source-grid">
            {sources.map((source) => {
              const health = healthFor(source);
              const isFetching = fetchingId === source.id;
              return (
                <article className={`source-card source-health-${health.status}`} key={source.id}>
                  <div className="source-card-header"><div><strong>{source.name}</strong><span className="source-category">{source.category}</span></div><span className={`source-status ${health.dot}`}>{health.label}</span></div>
                  <a className="source-url" href={source.feedUrl} target="_blank" rel="noreferrer">{source.feedUrl.replace(/^https?:\/\//, "").slice(0, 42)}{source.feedUrl.replace(/^https?:\/\//, "").length > 42 ? "…" : ""}<ExternalLink size={12} /></a>
                  <div className="source-meta"><span><Clock size={13} /> {formatInterval(source.intervalMinutes)}</span><span>Last run: {source.lastRunAt ? new Date(source.lastRunAt).toLocaleString() : "—"}</span></div>
                  {source.lastImportedCount !== null && source.lastImportedCount !== undefined && <div className="source-meta"><span>Last import: {source.lastImportedCount} new article{source.lastImportedCount === 1 ? "" : "s"}</span></div>}
                  {source.lastError && <p className="source-error"><AlertCircle size={13} /> {source.lastError}</p>}
                  <div className="source-actions">
                    <button className="primary-button" type="button" onClick={() => fetchSource(source)} disabled={isFetching || fetchingAll}>
                      {isFetching ? <Loader2 size={15} className="spinning" /> : <Download size={15} />} {isFetching ? "Fetching…" : "Fetch"}
                    </button>
                    <button className="secondary-button" type="button" onClick={() => toggleActive(source.id)}>{source.active ? <Pause size={15} /> : <Play size={15} />}{source.active ? "Pause" : "Activate"}</button>
                    <button className="secondary-button" type="button" onClick={() => preview(source)}><Radio size={15} /> Preview</button>
                    <button className="secondary-button" type="button" onClick={() => openEdit(source)}><Edit2 size={15} /> Edit</button>
                    <button className="more-button" type="button" onClick={() => removeSource(source.id, source.name)}><Trash2 size={15} /></button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {importResults && (
        <section className="workspace-panel">
          <div className="panel-heading">
            <div>
              <h2>Import results</h2>
              {fetchAllSummary ? (
                <p>{fetchAllSummary.totalImported} new article{fetchAllSummary.totalImported === 1 ? "" : "s"} imported, {fetchAllSummary.totalSkipped} skipped, {fetchAllSummary.failedCount} failed across {fetchAllSummary.totalSources} source{fetchAllSummary.totalSources === 1 ? "" : "s"}.</p>
              ) : (
                <p>{importResults[0]?.importedCount ?? 0} new article{(importResults[0]?.importedCount ?? 0) === 1 ? "" : "s"} imported, {importResults[0]?.skippedCount ?? 0} skipped from {importResults[0]?.sourceName}.</p>
              )}
            </div>
            <button className="more-button" type="button" onClick={() => { setImportResults(null); setFetchAllSummary(null); }}><X size={18} /></button>
          </div>
          {importResults.map((result) => (
            <div key={result.sourceId} className={`import-result ${result.status}`}>
              <div className="import-result-header">
                <strong>{result.sourceName}</strong>
                <span className={`import-status ${result.status}`}>
                  {result.status === "success" ? <CheckCircle2 size={15} /> : result.status === "failed" ? <AlertCircle size={15} /> : <RefreshCw size={15} />}
                  {result.status === "success" ? `${result.importedCount} imported` : result.status === "failed" ? "Failed" : `${result.importedCount} imported, ${result.skippedCount} skipped`}
                </span>
              </div>
              {result.error && <p className="source-error"><AlertCircle size={13} /> {result.error}</p>}
              {result.articles.length > 0 && (
                <div className="imported-articles">
                  {result.articles.map((article) => (
                    <div className="imported-article" key={article.id}>
                      <CheckCircle2 size={14} />
                      <span>{article.title}</span>
                      <small>/{article.slug}</small>
                    </div>
                  ))}
                </div>
              )}
              {result.skippedCount > 0 && result.articles.length === 0 && (
                <p className="category-notice">All {result.skippedCount} item{result.skippedCount === 1 ? "" : "s"} were already imported — no duplicates saved.</p>
              )}
            </div>
          ))}
        </section>
      )}

      {(previewSource || previewLoading || previewError || previewItems.length > 0) && (
        <section className="workspace-panel preview-results-panel">
          <div className="panel-heading"><div><h2>{previewSource ? "Preview: " + previewSource.name : "Preview"}</h2><p>{previewLoading ? "Fetching..." : previewItems.length > 0 ? previewItems.length + " items fetched (not saved)." : ""}</p></div><button className="more-button" type="button" onClick={clearPreview}><X size={18} /></button></div>
          {previewLoading && <div className="empty-state"><RefreshCw className="spinning" size={20} /> Fetching feed…</div>}
          {previewError && <p className="rss-error">{previewError}</p>}
          {previewItems.length > 0 && (
            <div className="preview-results">
              {previewItems.map((item, index) => (
                <article className="feed-item" key={item.link + "-" + index}>
                  <span className="feed-index">{String(index + 1).padStart(2, "0")}</span>
                  {item.imageUrl ? <img className="feed-thumbnail" src={item.imageUrl} alt="" /> : <div className="feed-thumbnail placeholder" aria-hidden="true" />}
                  <div className="feed-content">
                    <h3>{item.title}</h3>
                    {item.summary && <p>{stripHtml(item.summary).slice(0, 190)}</p>}
                    <small>{item.publishedAt || "No date"}</small>
                  </div>
                  {item.link && <a className="feed-link" href={item.link} target="_blank" rel="noreferrer"><ExternalLink size={17} /></a>}
                </article>
              ))}
            </div>
          )}
        </section>
      )}
    </main>
  );
}
