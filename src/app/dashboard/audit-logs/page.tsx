"use client";

import { Clock3, FileText, Search, Shield, UserRound, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api-client";

type AuditLog = {
  id: string;
  actorId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
};

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  article: <FileText size={15} />,
  editor: <UserRound size={15} />,
  menu: <Shield size={15} />,
  rss: <Clock3 size={15} />,
  subscriber: <UserRound size={15} />,
  settings: <Shield size={15} />,
};

const CATEGORY_LABELS: Record<string, string> = {
  article: "Articles",
  editor: "Editors",
  menu: "Menus",
  rss: "RSS",
  subscriber: "Subscribers",
  settings: "Settings",
};

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("All");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<AuditLog[]>(`/api/audit-logs?category=${categoryFilter}&search=${encodeURIComponent(query)}`)
      .then(setLogs)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [categoryFilter, query]);

  const filtered = useMemo(() => logs, [logs]);
  const selected = selectedId ? logs.find((log) => log.id === selectedId) : null;

  return (
    <main className="workspace-page">
      <header className="workspace-header">
        <div>
          <p className="eyebrow">ACTIVITY HISTORY</p>
          <h1>Audit logs</h1>
          <p className="subtitle">Record of important newsroom and system activity.</p>
        </div>
      </header>

      <section className="workspace-panel audit-list-panel">
        <div className="list-toolbar audit-toolbar">
          <label>
            <Search size={15} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search audit history…" />
          </label>
          <div className="status-tabs audit-tabs">
            {["All", "article", "editor", "menu", "rss", "subscriber", "settings"].map((item) => (
              <button key={item} className={categoryFilter === item ? "selected" : ""} onClick={() => setCategoryFilter(item)}>
                {item === "All" ? "All" : CATEGORY_LABELS[item] || item}
              </button>
            ))}
          </div>
        </div>

        {loading ? <div className="empty-state">Loading audit logs…</div> : filtered.length === 0 ? (
          <div className="empty-state">No audit entries match your search.</div>
        ) : (
          <div className="audit-list">
            {filtered.map((log) => (
              <article key={log.id} className={selectedId === log.id ? "selected" : ""}>
                <span className="metric-icon plum">{CATEGORY_ICONS[log.entityType] || <FileText size={15} />}</span>
                <button className="audit-content" type="button" onClick={() => setSelectedId(log.id === selectedId ? null : log.id)}>
                  <strong>{log.actorId || "System"}</strong> {log.action}
                  <small>{new Date(log.createdAt).toLocaleString()}</small>
                </button>
                <span className="audit-category">{CATEGORY_LABELS[log.entityType] || log.entityType}</span>
              </article>
            ))}
          </div>
        )}
      </section>

      {selected && (
        <section className="workspace-panel audit-detail-panel">
          <div className="panel-heading">
            <div>
              <h2>{selected.action}</h2>
              <p>{selected.actorId || "System"} · {new Date(selected.createdAt).toLocaleString()}</p>
            </div>
            <button className="more-button" type="button" onClick={() => setSelectedId(null)} aria-label="Close details"><X size={18} /></button>
          </div>
          <p className="audit-detail-text">Entity: {selected.entityType}{selected.entityId ? ` (${selected.entityId})` : ""}</p>
          {selected.metadata && (
            <div className="audit-metadata">
              {Object.entries(selected.metadata).map(([key, value]) => (
                <div key={key}><strong>{key}</strong><span>{String(value)}</span></div>
              ))}
            </div>
          )}
        </section>
      )}
    </main>
  );
}
