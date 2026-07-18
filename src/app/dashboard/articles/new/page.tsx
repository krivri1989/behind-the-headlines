"use client";

import { ArrowLeft, ImagePlus, Save, Send } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";

type Category = { id: string; name: string };

export default function NewArticlePage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [content, setContent] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch<Category[]>("/api/categories").then(setCategories).catch(() => {});
  }, []);

  async function save(status: string) {
    if (!title.trim()) { alert("Title is required"); return; }
    setSaving(true);
    try {
      const article = await apiFetch<{ id: string }>("/api/articles", {
        method: "POST",
        body: JSON.stringify({
          title, excerpt: summary, content, status,
          categoryIds: categoryId ? [categoryId] : [],
          seoTitle, seoDescription,
        }),
      });
      router.push(`/dashboard/articles/${article.id}`);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to save article");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="workspace-page editor-page">
      <header className="editor-header">
        <Link href="/dashboard/articles" className="back-link"><ArrowLeft size={17} /> Articles</Link>
        <div>
          <button className="secondary-button" onClick={() => save("draft")} disabled={saving}><Save size={16} /> Save draft</button>
          <button className="primary-button" onClick={() => save("published")} disabled={saving}><Send size={16} /> Publish</button>
        </div>
      </header>
      <div className="editor-layout">
        <section className="editor-canvas">
          <p className="eyebrow">NEW ARTICLE</p>
          <input className="article-title-input" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Write a clear, informative headline" />
          <input className="article-summary-input" value={summary} onChange={(event) => setSummary(event.target.value)} placeholder="Add a concise summary for search and social sharing" />
          <div className="rich-toolbar">
            <button type="button" onClick={() => document.execCommand("bold")}><b>B</b></button>
            <button type="button" onClick={() => document.execCommand("italic")}><i>I</i></button>
            <button type="button" onClick={() => document.execCommand("formatBlock", false, "h2")}>H2</button>
          </div>
          <div className="editor-body" contentEditable suppressContentEditableWarning data-placeholder="Start writing your story…" onInput={(e) => setContent(e.currentTarget.innerText)} />
        </section>
        <aside className="editor-sidebar">
          <h2>Publishing</h2>
          <label>Category
            <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
              <option value="" disabled>Select category</option>
              {categories.map((cat) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
            </select>
          </label>
          <div className="featured-drop"><ImagePlus size={20} /><strong>Featured image</strong><span>Upload from media library</span><button type="button">Choose image</button></div>
          <hr />
          <h2>SEO</h2>
          <label>SEO title<input value={seoTitle} onChange={(event) => setSeoTitle(event.target.value)} placeholder="Optional override" /></label>
          <label>Meta description<textarea rows={4} value={seoDescription} onChange={(event) => setSeoDescription(event.target.value)} placeholder="Brief search description" /></label>
        </aside>
      </div>
    </main>
  );
}
