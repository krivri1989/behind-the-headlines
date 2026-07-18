"use client";

import { Eye, Save, Send, Trash2, ImagePlus, X } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";

type FeaturedImage = { url: string; alt: string; caption: string; credit: string; width?: number; height?: number };
type Article = {
  id: string;
  title: string;
  excerpt: string;
  content: string;
  status: string;
  categories: string[];
  featuredImage?: FeaturedImage | null;
  author?: { id: string; name: string };
  sourceName?: string;
  sourceUrl?: string;
};

type MediaItem = { id: string; url: string; filename: string; alt: string; contentType: string; size: number };

export default function EditArticlePage() {
  const params = useParams();
  const router = useRouter();
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(false);
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [altText, setAltText] = useState("");

  useEffect(() => {
    apiFetch<Article>(`/api/articles/${params.id}`)
      .then((a) => {
        setArticle(a);
        setAltText(a.featuredImage?.alt || "");
      })
      .catch(() => router.push("/dashboard/articles"))
      .finally(() => setLoading(false));
  }, [params.id, router]);

  async function loadMedia() {
    setMediaLoading(true);
    try {
      const result = await apiFetch<{ media: MediaItem[] }>(`/api/media?limit=24`);
      setMediaItems(result.media || []);
    } catch { /* ignore */ }
    finally { setMediaLoading(false); }
  }

  function openMediaPicker() {
    setMediaPickerOpen(true);
    loadMedia();
  }

  function selectMedia(item: MediaItem) {
    if (!article) return;
    const newImage: FeaturedImage = {
      url: item.url,
      alt: altText || item.alt || item.filename,
      caption: article.featuredImage?.caption || "",
      credit: article.featuredImage?.credit || "",
    };
    setArticle({ ...article, featuredImage: newImage });
    setMediaPickerOpen(false);
    // Save immediately
    saveFeaturedImage(newImage);
  }

  function removeFeaturedImage() {
    if (!article) return;
    setArticle({ ...article, featuredImage: null });
    saveFeaturedImage(null);
  }

  async function saveFeaturedImage(img: FeaturedImage | null) {
    if (!article) return;
    try {
      await apiFetch(`/api/articles/${article.id}`, {
        method: "PUT",
        body: JSON.stringify({ featuredImage: img }),
      });
    } catch { /* ignore — will be saved on full save */ }
  }

  async function saveAltText() {
    if (!article?.featuredImage) return;
    const updated = { ...article.featuredImage, alt: altText };
    setArticle({ ...article, featuredImage: updated });
    await saveFeaturedImage(updated);
  }

  async function save(status: string) {
    if (!article) return;
    setSaving(true);
    try {
      const body: Record<string, unknown> = { status };
      if (article.featuredImage !== undefined) body.featuredImage = article.featuredImage;
      await apiFetch(`/api/articles/${article.id}`, { method: "PUT", body: JSON.stringify(body) });
      setArticle({ ...article, status });
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!article || !confirm("Delete this article?")) return;
    try {
      await apiFetch(`/api/articles/${article.id}`, { method: "DELETE", body: JSON.stringify({ id: article.id }) });
      router.push("/dashboard/articles");
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to delete");
    }
  }

  if (loading) return <main className="workspace-page"><p className="empty-state">Loading article…</p></main>;
  if (!article) return null;

  return (
    <main className="workspace-page editor-page">
      <header className="editor-header">
        <Link href="/dashboard/articles" className="back-link">Articles</Link>
        <div>
          <button className="secondary-button" onClick={() => save("draft")} disabled={saving}><Save size={16} /> Save draft</button>
          <button className="secondary-button" onClick={() => save("unpublished")} disabled={saving}>Unpublish</button>
          <button className="primary-button" onClick={() => save("published")} disabled={saving}><Send size={16} /> Publish</button>
        </div>
      </header>
      <p className="category-notice">Status: <strong>{article.status}</strong>{article.author && <span> · By {article.author.name}</span>}{article.sourceName && <span> · Source: {article.sourceName}</span>}</p>
      <div className="editor-layout">
        <section className="editor-canvas">
          <input className="article-title-input" defaultValue={article.title} onChange={(e) => setArticle({ ...article, title: e.target.value })} />
          <div className="rich-toolbar">
            <button onClick={() => document.execCommand("bold")}><b>B</b></button>
            <button onClick={() => document.execCommand("italic")}><i>I</i></button>
            <button onClick={() => document.execCommand("formatBlock", false, "h2")}>H2</button>
          </div>
          <div className="editor-body" contentEditable suppressContentEditableWarning defaultValue={article.content}>{article.content}</div>
        </section>
        <aside className="editor-sidebar">
          <h2>Article actions</h2>
          <button className="secondary-button" onClick={() => setPreview(!preview)}><Eye size={16} /> {preview ? "Close preview" : "Preview article"}</button>
          <button className="remove-menu-item" onClick={remove}><Trash2 size={16} /> Delete article</button>

          {/* Featured image section */}
          <div className="featured-image-section">
            <label>Featured image</label>
            {article.featuredImage ? (
              <div className="featured-image-preview">
                <div className="featured-image-thumb">
                  <img src={article.featuredImage.url} alt={article.featuredImage.alt || article.title} />
                </div>
                <input
                  type="text"
                  className="alt-text-input"
                  placeholder="Alt text for accessibility"
                  value={altText}
                  onChange={(e) => setAltText(e.target.value)}
                  onBlur={saveAltText}
                />
                <div className="featured-image-actions">
                  <button className="secondary-button" type="button" onClick={openMediaPicker}><ImagePlus size={14} /> Change</button>
                  <button className="remove-menu-item" type="button" onClick={removeFeaturedImage}><X size={14} /> Remove</button>
                </div>
              </div>
            ) : (
              <button className="secondary-button" type="button" onClick={openMediaPicker}><ImagePlus size={16} /> Select featured image</button>
            )}
          </div>
        </aside>
      </div>

      {/* Preview */}
      {preview && (
        <section className="workspace-panel">
          <h2>Article preview</h2>
          {article.featuredImage && (
            <img src={article.featuredImage.url} alt={article.featuredImage.alt || article.title} style={{ maxWidth: "100%", borderRadius: 8, marginBottom: 16 }} />
          )}
          <h1>{article.title}</h1>
          {article.excerpt && <p style={{ color: "#666", fontSize: 16, fontStyle: "italic" }}>{article.excerpt}</p>}
          <div dangerouslySetInnerHTML={{ __html: article.content }} />
        </section>
      )}

      {/* Media picker modal */}
      {mediaPickerOpen && (
        <div className="media-picker-overlay" onClick={() => setMediaPickerOpen(false)}>
          <div className="media-picker-modal" onClick={(e) => e.stopPropagation()}>
            <div className="media-picker-header">
              <h2>Select featured image</h2>
              <button className="more-button" onClick={() => setMediaPickerOpen(false)}><X size={18} /></button>
            </div>
            {mediaLoading ? (
              <p className="empty-state">Loading media…</p>
            ) : mediaItems.length === 0 ? (
              <p className="empty-state">No media found. Upload images in the Media library first.</p>
            ) : (
              <div className="media-picker-grid">
                {mediaItems.map((item) => (
                  <button
                    key={item.id}
                    className="media-picker-item"
                    type="button"
                    onClick={() => selectMedia(item)}
                  >
                    <img src={item.url} alt={item.alt || item.filename} loading="lazy" />
                    <span>{item.filename}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
