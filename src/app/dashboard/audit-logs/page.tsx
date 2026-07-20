"use client";

import { CheckCircle2, AlertCircle, Clock3, Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { AdminGuard } from "@/components/admin-guard";

type RssImport = {
  id: string;
  sourceId: string;
  sourceName: string;
  status: string;
  importedCount: number;
  skippedCount: number;
  error?: string;
  createdAt: string;
};

const STATUS_META: Record<string, { icon: React.ReactNode; label: string; className: string }> = {
  success: { icon: <CheckCircle2 size={15} />, label: "Success", className: "status-success" },
  partial: { icon: <Clock3 size={15} />, label: "Partial", className: "status-partial" },
  failed: { icon: <AlertCircle size={15} />, label: "Failed", className: "status-failed" },
};

export default function AuditLogsPage() {
  const [imports, setImports] = useState<RssImport[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    apiFetch<RssImport[]>(`/api/rss-imports?search=${encodeURIComponent(query)}`)
      .then(setImports)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [query]);

  const selected = selectedId ? imports.find((imp) => imp.id === selectedId) : null;

  return (
    <AdminGuard>
      <main className="workspace-page">
        <header className="workspace-header">
          <div>
            <p className="eyebrow">RSS ACTIVITY HISTORY</p>
            <h1>RSS Audit</h1>
            <p className="subtitle">Record of RSS import activity and feed events.</p>
          </div>
        </header>

        <section className="workspace-panel audit-list-panel">
          <div className="list-toolbar audit-toolbar">
            <label>
              <Search size={15} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by source name or status…" />
            </label>
          </div>

          {loading ? <div className="empty-state">Loading RSS audit logs…</div> : imports.length === 0 ? (
            <div className="empty-state">No RSS import entries match your search.</div>
          ) : (
            <div className="audit-list">
              {imports.map((imp) => {
                const meta = STATUS_META[imp.status] || STATUS_META.partial;
                return (
                  <article key={imp.id} className={selectedId === imp.id ? "selected" : ""}>
                    <span className={"metric-icon " + meta.className}>{meta.icon}</span>
                    <button className="audit-content" type="button" onClick={() => setSelectedId(imp.id === selectedId ? null : imp.id)}>
                      <strong>{imp.sourceName}</strong> {imp.importedCount} imported, {imp.skippedCount} skipped
                      <small>{new Date(imp.createdAt).toLocaleString()}</small>
                    </button>
                    <span className="audit-category">{meta.label}</span>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {selected && (
          <section className="workspace-panel audit-detail-panel">
            <div className="panel-heading">
              <div>
                <h2>{selected.sourceName}</h2>
                <p>{new Date(selected.createdAt).toLocaleString()}</p>
              </div>
              <button className="more-button" type="button" onClick={() => setSelectedId(null)} aria-label="Close details"><X size={18} /></button>
            </div>
            <div className="audit-metadata">
              <div><strong>Status</strong><span>{(STATUS_META[selected.status] || STATUS_META.partial).label}</span></div>
              <div><strong>Imported</strong><span>{selected.importedCount}</span></div>
              <div><strong>Skipped</strong><span>{selected.skippedCount}</span></div>
            </div>
            {selected.error && (
              <p className="audit-detail-text" style={{ marginTop: 12, color: "#c0392b" }}>Error: {selected.error}</p>
            )}
          </section>
        )}
      </main>
    </AdminGuard>
  );
}
