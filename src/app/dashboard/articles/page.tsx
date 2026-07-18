"use client";

import { ChevronLeft, ChevronRight, Plus, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api-client";

type Article = { id: string; title: string; status: string; author: string; categories: string[]; updatedAt: string };
type ArticlesResponse = { articles: Article[]; total: number; page: number; limit: number; totalPages: number };

const PAGE_SIZE = 20;

export default function ArticlesPage() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ArticlesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setLoading(true);
    setSelected(new Set());
    apiFetch<ArticlesResponse>(`/api/articles?status=${status}&search=${encodeURIComponent(query)}&page=${page}&limit=${PAGE_SIZE}`)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [status, query, page]);

  const articles = data?.articles ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  const allSelected = articles.length > 0 && articles.every((a) => selected.has(a.id));
  const someSelected = articles.some((a) => selected.has(a.id));

  const toggleSelectAll = useCallback(() => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(articles.map((a) => a.id)));
    }
  }, [allSelected, articles]);

  const toggleSelect = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectedCount = selected.size;

  async function bulkDelete() {
    if (selectedCount === 0) return;
    if (!confirm(`Delete ${selectedCount} article${selectedCount === 1 ? "" : "s"}? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await apiFetch("/api/articles", { method: "DELETE", body: JSON.stringify({ ids: Array.from(selected) }) });
      setSelected(new Set());
      // Refresh
      const fresh = await apiFetch<ArticlesResponse>(`/api/articles?status=${status}&search=${encodeURIComponent(query)}&page=${page}&limit=${PAGE_SIZE}`);
      setData(fresh);
      if (fresh.articles.length === 0 && page > 1) setPage(page - 1);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to delete articles");
    } finally {
      setDeleting(false);
    }
  }

  function goToPage(p: number) {
    if (p < 1 || p > totalPages) return;
    setPage(p);
  }

  const pageNumbers: number[] = [];
  const startPage = Math.max(1, page - 2);
  const endPage = Math.min(totalPages, page + 2);
  for (let i = startPage; i <= endPage; i++) pageNumbers.push(i);

  return (
    <main className="workspace-page">
      <header className="workspace-header">
        <div><p className="eyebrow">CONTENT MANAGEMENT</p><h1>Articles</h1><p className="subtitle">{total.toLocaleString()} article{total === 1 ? "" : "s"} total</p></div>
        <Link className="primary-button" href="/dashboard/articles/new"><Plus size={18} /> Create article</Link>
      </header>

      {selectedCount > 0 && (
        <div className="bulk-action-bar">
          <span>{selectedCount} selected</span>
          <button className="remove-menu-item" type="button" onClick={bulkDelete} disabled={deleting}>
            <Trash2 size={16} /> {deleting ? "Deleting…" : "Delete selected"}
          </button>
          <button className="secondary-button" type="button" onClick={() => setSelected(new Set())}>Clear selection</button>
        </div>
      )}

      <section className="workspace-panel">
        <div className="article-controls">
          <label><Search size={17} /><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Search your articles" /></label>
          <div className="status-tabs">
            {["All", "published", "draft", "archived"].map((item) => (
              <button className={status === item ? "selected" : ""} onClick={() => { setStatus(item); setPage(1); }} type="button" key={item}>{item === "All" ? "All" : item.charAt(0).toUpperCase() + item.slice(1)}</button>
            ))}
          </div>
        </div>

        <div className="article-list">
          <div className="article-list-heading article-list-heading-checkbox">
            <label className="checkbox-cell">
              <input type="checkbox" checked={allSelected} ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected; }} onChange={toggleSelectAll} />
            </label>
            <span>ARTICLE</span>
            <span>AUTHOR</span>
            <span>STATUS</span>
            <span>UPDATED</span>
          </div>

          {loading ? (
            <p className="empty-state">Loading articles…</p>
          ) : articles.length === 0 ? (
            <p className="empty-state">No articles match your search. <Link href="/dashboard/articles/new" style={{ color: "var(--plum)", fontWeight: 700 }}>Create one</Link>.</p>
          ) : articles.map((article) => (
            <article className="article-row article-row-checkbox" key={article.id}>
              <label className="checkbox-cell">
                <input type="checkbox" checked={selected.has(article.id)} onChange={() => toggleSelect(article.id)} />
              </label>
              <div>
                <Link className="article-edit-link" href={`/dashboard/articles/${article.id}`}><strong>{article.title}</strong></Link>
                <span>{article.categories.join(", ") || "Uncategorized"}</span>
              </div>
              <span>{article.author}</span>
              <span className={`status ${article.status}`}>{article.status}</span>
              <span>{new Date(article.updatedAt).toLocaleDateString()}</span>
            </article>
          ))}
        </div>

        {totalPages > 1 && (
          <div className="pagination">
            <button className="secondary-button" type="button" onClick={() => goToPage(page - 1)} disabled={page === 1}>
              <ChevronLeft size={16} /> Prev
            </button>
            {startPage > 1 && <button className="page-number" type="button" onClick={() => goToPage(1)}>1</button>}
            {startPage > 2 && <span className="page-ellipsis">…</span>}
            {pageNumbers.map((p) => (
              <button className={`page-number ${p === page ? "selected" : ""}`} type="button" key={p} onClick={() => goToPage(p)}>{p}</button>
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
    </main>
  );
}
