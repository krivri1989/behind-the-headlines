"use client";

import { ChevronLeft, ChevronRight, Copy, ImagePlus, Loader2, Search, Trash2, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { apiFetch, apiUpload } from "@/lib/api-client";

type MediaItem = { id: string; key: string; url: string; filename: string; contentType: string; size: number; alt: string; createdAt: string };
type MediaResponse = { media: MediaItem[]; total: number; page: number; limit: number; totalPages: number };

const PAGE_SIZE = 50;

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function MediaPage() {
  const [data, setData] = useState<MediaResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [uploading, setUploading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [alt, setAlt] = useState("");
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLoading(true);
    apiFetch<MediaResponse>(`/api/media?search=${encodeURIComponent(query)}&page=${page}&limit=${PAGE_SIZE}`)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [query, page]);

  const media = data?.media ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  async function refresh() {
    const fresh = await apiFetch<MediaResponse>(`/api/media?search=${encodeURIComponent(query)}&page=${page}&limit=${PAGE_SIZE}`);
    setData(fresh);
  }

  async function upload(files: FileList) {
    setUploading(true);
    setError("");
    for (const file of Array.from(files)) {
      const formData = new FormData();
      formData.append("file", file);
      try {
        await apiUpload("/api/media", formData);
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Upload failed");
      }
    }
    setUploading(false);
    await refresh();
  }

  async function saveAlt(id: string) {
    try { await apiFetch("/api/media", { method: "PUT", body: JSON.stringify({ id, alt }) }); await refresh(); } catch (error) { alert(error instanceof Error ? error.message : "Failed to save"); }
  }

  async function removeMedia(id: string, filename: string) {
    if (!confirm(`Delete ${filename}?`)) return;
    try { await apiFetch("/api/media", { method: "DELETE", body: JSON.stringify({ id }) }); if (selectedId === id) setSelectedId(null); await refresh(); } catch (error) { alert(error instanceof Error ? error.message : "Failed to delete"); }
  }

  function copyUrl(url: string) { navigator.clipboard.writeText(url); }

  function goToPage(p: number) {
    if (p < 1 || p > totalPages) return;
    setPage(p);
  }

  const pageNumbers: number[] = [];
  const startPage = Math.max(1, page - 2);
  const endPage = Math.min(totalPages, page + 2);
  for (let i = startPage; i <= endPage; i++) pageNumbers.push(i);

  const selected = selectedId ? media.find((m) => m.id === selectedId) : null;

  return (
    <main className="workspace-page">
      <header className="workspace-header">
        <div><p className="eyebrow">ASSET LIBRARY</p><h1>Media library</h1><p className="subtitle">{total.toLocaleString()} image{total === 1 ? "" : "s"} in RustFS</p></div>
        <button className="primary-button" type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
          {uploading ? <Loader2 size={18} className="spinning" /> : <Upload size={18} />} {uploading ? "Uploading…" : "Upload media"}
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={(event) => event.target.files && upload(event.target.files)} />
      </header>

      {error && <p className="login-error">{error}</p>}

      <section className="workspace-panel">
        <div className="media-toolbar"><label><Search size={17} /><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Search media by filename" /></label></div>
        {loading ? <div className="empty-state">Loading media…</div> : media.length === 0 ? (
          <div className="empty-state"><ImagePlus size={32} /><p>No media found.</p></div>
        ) : (
          <div className="media-grid">
            {media.map((item) => (
              <article className={"media-card" + (selectedId === item.id ? " selected" : "")} key={item.id} onClick={() => { setSelectedId(item.id); setAlt(item.alt); }}>
                <div className="media-thumbnail"><img src={item.url} alt={item.alt || item.filename} loading="lazy" /></div>
                <div className="media-info"><strong>{item.filename}</strong><span>{item.contentType} · {formatSize(item.size)}</span></div>
                <div className="media-actions">
                  <button className="more-button" type="button" onClick={(event) => { event.stopPropagation(); copyUrl(item.url); }}><Copy size={15} /></button>
                  <button className="more-button" type="button" onClick={(event) => { event.stopPropagation(); removeMedia(item.id, item.filename); }}><Trash2 size={15} /></button>
                </div>
              </article>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="pagination">
            <button className="secondary-button" type="button" onClick={() => goToPage(page - 1)} disabled={page === 1}>
              <ChevronLeft size={16} /> Prev
            </button>
            {startPage > 1 && <button className="page-number" type="button" onClick={() => goToPage(1)}>1</button>}
            {startPage > 2 && <span className="page-ellipsis">…</span>}
            {pageNumbers.map((p) => (
              <button className={"page-number" + (p === page ? " selected" : "")} type="button" key={p} onClick={() => goToPage(p)}>{p}</button>
            ))}
            {endPage < totalPages - 1 && <span className="page-ellipsis">…</span>}
            {endPage < totalPages && <button className="page-number" type="button" onClick={() => goToPage(totalPages)}>{totalPages}</button>}
            <button className="secondary-button" type="button" onClick={() => goToPage(page + 1)} disabled={page === totalPages}>
              Next <ChevronRight size={16} />
            </button>
            <span className="page-info">Page {page} of {totalPages}</span>
          </div>
        )}
      </section>

      {selected && (
        <section className="workspace-panel">
          <div className="panel-heading"><div><h2>Edit {selected.filename}</h2><p>Update alt text for accessibility.</p></div></div>
          <div className="settings-grid">
            <label>Alt text<input value={alt} onChange={(event) => setAlt(event.target.value)} placeholder="Describe the image for screen readers" /></label>
            <label>URL<input defaultValue={selected.url} readOnly /></label>
            <label>Size<input defaultValue={formatSize(selected.size)} readOnly /></label>
            <label>Type<input defaultValue={selected.contentType} readOnly /></label>
          </div>
          <button className="primary-button" type="button" onClick={() => saveAlt(selected.id)}>Save changes</button>
        </section>
      )}
    </main>
  );
}
