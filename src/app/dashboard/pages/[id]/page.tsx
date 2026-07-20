"use client";

import { ArrowLeft, Save, Send, Trash2, ImagePlus, Eye } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { AdminGuard } from "@/components/admin-guard";

type PageData = {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string;
  status: string;
  seoTitle: string;
  seoDescription: string;
};

type MediaItem = { id: string; url: string; filename: string; alt: string; contentType: string };

export default function EditPageEditor() {
  const params = useParams();
  const router = useRouter();
  const [page, setPage] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [mediaLoading, setMediaLoading] = useState(false);

  useEffect(() => {
    apiFetch<PageData>(`/api/pages/${params.id}`)
      .then(setPage)
      .catch(() => router.push("/dashboard/pages"))
      .finally(() => setLoading(false));
  }, [params.id, router]);

  async function save(status: string) {
    if (!page) return;
    setSaving(true);
    try {
      await apiFetch(`/api/pages/${page.id}`, {
        method: "PUT",
        body: JSON.stringify({
          title: page.title,
          excerpt: page.excerpt,
          content: page.content,
          status,
          seoTitle: page.seoTitle,
          seoDescription: page.seoDescription,
        }),
      });
      setPage({ ...page, status });
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!page || !confirm(`Delete "${page.title}"?`)) return;
    try {
      await apiFetch(`/api/pages/${page.id}`, { method: "DELETE", body: JSON.stringify({}) });
      router.push("/dashboard/pages");
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to delete");
    }
  }

  async function loadMedia() {
    setMediaLoading(true);
    try {
      const result = await apiFetch<{ media: MediaItem[] }>("/api/media?limit=24");
      setMediaItems(result.media || []);
    } catch { /* ignore */ }
    finally { setMediaLoading(false); }
  }

  function insertImage(item: MediaItem) {
    const img = `<img src="${item.url}" alt="${item.alt || item.filename}" style="max-width:100%;height:auto;border-radius:8px;margin:16px 0;" />`;
    document.execCommand("insertHTML", false, img);
    setMediaPickerOpen(false);
  }

  if (loading) return <main className="workspace-page"><p className="empty-state">Loading page…</p></main>;
  if (!page) return null;

  return (
    <AdminGuard>
    <main className="workspace-page editor-page">
      <header className="editor-header">
        <Link href="/dashboard/pages" className="back-link"><ArrowLeft size={17} /> Pages</Link>
        <div>
          <button className="secondary-button" onClick={() => save("draft")} disabled={saving}><Save size={16} /> Save draft</button>
          <button className="primary-button" onClick={() => save("published")} disabled={saving}><Send size={16} /> Publish</button>
        </div>
      </header>
      <p className="category-notice">Status: <strong>{page.status}</strong> · URL: /page/{page.slug}{page.status === "published" && <span> · <a href={`/page/${page.slug}`} target="_blank" rel="noopener noreferrer">View page →</a></span>}</p>
      <div className="editor-layout">
        <section className="editor-canvas">
          <input className="article-title-input" value={page.title} onChange={(e) => setPage({ ...page, title: e.target.value })} />
          <input className="article-summary-input" value={page.excerpt} onChange={(e) => setPage({ ...page, excerpt: e.target.value })} placeholder="Short description (optional)" />
          <div className="rich-toolbar">
            <button type="button" onClick={() => document.execCommand("bold")}><b>B</b></button>
            <button type="button" onClick={() => document.execCommand("italic")}><i>I</i></button>
            <button type="button" onClick={() => document.execCommand("underline")}><u>U</u></button>
            <button type="button" onClick={() => document.execCommand("formatBlock", false, "h2")}>H2</button>
            <button type="button" onClick={() => document.execCommand("formatBlock", false, "h3")}>H3</button>
            <button type="button" onClick={() => document.execCommand("formatBlock", false, "p")}>P</button>
            <button type="button" onClick={() => document.execCommand("insertUnorderedList")}>• List</button>
            <button type="button" onClick={() => document.execCommand("insertOrderedList")}>1. List</button>
            <button type="button" onClick={() => { setMediaPickerOpen(true); loadMedia(); }}><ImagePlus size={14} /> Image</button>
            <button type="button" onClick={() => {
              const url = prompt("Enter URL:");
              if (url) document.execCommand("createLink", false, url);
            }}>Link</button>
          </div>
          <div
            className="editor-body"
            contentEditable
            suppressContentEditableWarning
            dangerouslySetInnerHTML={{ __html: page.content }}
            onInput={(e) => setPage({ ...page, content: e.currentTarget.innerHTML })}
          />
        </section>
        <aside className="editor-sidebar">
          <h2>Page actions</h2>
          {page.status === "published" && (
            <a href={`/page/${page.slug}`} target="_blank" rel="noopener noreferrer" className="secondary-button"><Eye size={16} /> View live page</a>
          )}
          <button className="remove-menu-item" onClick={remove}><Trash2 size={16} /> Delete page</button>
          <hr />
          <h2>SEO</h2>
          <label>SEO title<input value={page.seoTitle} onChange={(e) => setPage({ ...page, seoTitle: e.target.value })} placeholder="Optional override" /></label>
          <label>Meta description<textarea rows={4} value={page.seoDescription} onChange={(e) => setPage({ ...page, seoDescription: e.target.value })} placeholder="Brief search description" /></label>
        </aside>
      </div>

      {mediaPickerOpen && (
        <div className="media-picker-overlay" onClick={() => setMediaPickerOpen(false)}>
          <div className="media-picker-modal" onClick={(e) => e.stopPropagation()}>
            <div className="media-picker-header">
              <h2>Insert image</h2>
              <button className="more-button" onClick={() => setMediaPickerOpen(false)}>✕</button>
            </div>
            <div className="media-picker-grid">
              {mediaLoading ? <p>Loading media…</p> : mediaItems.length === 0 ? <p>No media found. Upload images from the Media library.</p> : (
                mediaItems.map((item) => (
                  <button key={item.id} className="media-picker-item" onClick={() => insertImage(item)}>
                    <img src={item.url} alt={item.alt || item.filename} />
                    <span>{item.filename}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </main>
    </AdminGuard>
  );
}
