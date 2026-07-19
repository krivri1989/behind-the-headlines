"use client";

import { ArrowLeft, Save, Send, ImagePlus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useRef, useCallback } from "react";
import { apiFetch } from "@/lib/api-client";

type MediaItem = { id: string; url: string; filename: string; alt: string; contentType: string };

export default function NewPageEditor() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);

  const exec = useCallback((command: string, value: string | undefined = undefined) => {
    document.execCommand(command, false, value);
    if (editorRef.current) editorRef.current.focus();
  }, []);

  async function save(status: string) {
    if (!title.trim()) { alert("Title is required"); return; }
    const content = editorRef.current?.innerHTML || "";
    setSaving(true);
    try {
      const page = await apiFetch<{ id: string }>("/api/pages", {
        method: "POST",
        body: JSON.stringify({ title, excerpt, content, status, seoTitle, seoDescription }),
      });
      router.push(`/dashboard/pages/${page.id}`);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to save page");
    } finally {
      setSaving(false);
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
    if (editorRef.current) editorRef.current.focus();
    setMediaPickerOpen(false);
  }

  return (
    <main className="workspace-page editor-page">
      <header className="editor-header">
        <Link href="/dashboard/pages" className="back-link"><ArrowLeft size={17} /> Pages</Link>
        <div>
          <button className="secondary-button" onClick={() => save("draft")} disabled={saving}><Save size={16} /> Save draft</button>
          <button className="primary-button" onClick={() => save("published")} disabled={saving}><Send size={16} /> Publish</button>
        </div>
      </header>
      <div className="editor-layout">
        <section className="editor-canvas">
          <p className="eyebrow">NEW PAGE</p>
          <input className="article-title-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Page title (e.g. About Us)" />
          <input className="article-summary-input" value={excerpt} onChange={(e) => setExcerpt(e.target.value)} placeholder="Short description (optional)" />
          <div className="rich-toolbar">
            <button type="button" onClick={() => exec("bold")}><b>B</b></button>
            <button type="button" onClick={() => exec("italic")}><i>I</i></button>
            <button type="button" onClick={() => exec("underline")}><u>U</u></button>
            <button type="button" onClick={() => exec("formatBlock", "H2")}>H2</button>
            <button type="button" onClick={() => exec("formatBlock", "H3")}>H3</button>
            <button type="button" onClick={() => exec("formatBlock", "P")}>P</button>
            <button type="button" onClick={() => exec("insertUnorderedList")}>• List</button>
            <button type="button" onClick={() => exec("insertOrderedList")}>1. List</button>
            <button type="button" onClick={() => { setMediaPickerOpen(true); loadMedia(); }}><ImagePlus size={14} /> Image</button>
            <button type="button" onClick={() => {
              const url = prompt("Enter URL:");
              if (url) exec("createLink", url);
            }}>Link</button>
            <button type="button" onClick={() => exec("unlink")}>Unlink</button>
            <button type="button" onClick={() => exec("removeFormat")}>Clear</button>
          </div>
          <div
            ref={editorRef}
            className="editor-body"
            contentEditable
            suppressContentEditableWarning
            data-placeholder="Start writing your page content…"
          />
        </section>
        <aside className="editor-sidebar">
          <h2>Page settings</h2>
          <p className="category-notice">Published pages are automatically added to the footer menu. You can drag them to the header menu from the Menus page.</p>
          <hr />
          <h2>SEO</h2>
          <label>SEO title<input value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} placeholder="Optional override" /></label>
          <label>Meta description<textarea rows={4} value={seoDescription} onChange={(e) => setSeoDescription(e.target.value)} placeholder="Brief search description" /></label>
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
  );
}
