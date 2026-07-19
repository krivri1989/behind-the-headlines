"use client";

import { FileText, Plus, Trash2, Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";

type PageItem = {
  id: string;
  title: string;
  slug: string;
  status: string;
  excerpt: string;
  updatedAt: string;
};

export default function PagesListPage() {
  const [pages, setPages] = useState<PageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");

  async function loadPages() {
    setLoading(true);
    try {
      const data = await apiFetch<{ pages: PageItem[] }>("/api/pages");
      setPages(data.pages || []);
    } catch {
      setPages([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadPages(); }, []);

  async function remove(id: string, title: string) {
    if (!confirm(`Delete "${title}"? This will also remove it from menus.`)) return;
    try {
      await apiFetch(`/api/pages/${id}`, { method: "DELETE", body: JSON.stringify({}) });
      setPages((prev) => prev.filter((p) => p.id !== id));
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to delete page");
    }
  }

  const filtered = filter === "all" ? pages : pages.filter((p) => p.status === filter);

  return (
    <main className="workspace-page">
      <header className="workspace-header">
        <div>
          <p className="eyebrow">SITE CONTENT</p>
          <h1>Pages</h1>
          <p className="subtitle">Create and manage static pages like About, Privacy, Contact, etc.</p>
        </div>
        <Link href="/dashboard/pages/new" className="primary-button"><Plus size={18} /> New page</Link>
      </header>

      <div className="status-tabs">
        {["all", "published", "draft"].map((s) => (
          <button key={s} className={filter === s ? "selected" : ""} onClick={() => setFilter(s)}>
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="workspace-panel"><p className="empty-state">Loading pages…</p></div>
      ) : filtered.length === 0 ? (
        <div className="workspace-panel">
          <div className="empty-state">
            <FileText size={32} />
            <p>No {filter !== "all" ? filter : ""} pages yet.</p>
            <Link href="/dashboard/pages/new" className="primary-button"><Plus size={16} /> Create your first page</Link>
          </div>
        </div>
      ) : (
        <div className="workspace-panel">
          {filtered.map((page) => (
            <div className="article-row" key={page.id}>
              <div>
                <strong>{page.title}</strong>
                <span>/page/{page.slug}</span>
                {page.excerpt && <span style={{ color: "#999", fontSize: 11 }}>{page.excerpt.slice(0, 80)}{page.excerpt.length > 80 ? "…" : ""}</span>}
              </div>
              <span className={`status-badge ${page.status}`}>{page.status}</span>
              <span style={{ fontSize: 11, color: "#aaa" }}>{new Date(page.updatedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
              <div style={{ display: "flex", gap: 8 }}>
                <Link href={`/dashboard/pages/${page.id}`} className="secondary-button">Edit</Link>
                {page.status === "published" && (
                  <a href={`/page/${page.slug}`} target="_blank" rel="noopener noreferrer" className="secondary-button"><Eye size={14} /> View</a>
                )}
                <button className="remove-menu-item" onClick={() => remove(page.id, page.title)} aria-label={`Delete ${page.title}`}><Trash2 size={16} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
