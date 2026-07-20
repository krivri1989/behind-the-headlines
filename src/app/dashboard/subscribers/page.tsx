"use client";

import { Download, Mail, MoreHorizontal, Search, Trash2, UserPlus, X } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { AdminGuard } from "@/components/admin-guard";

type Subscriber = { id: string; email: string; status: string; consentedAt: string; sourcePath: string };

export default function SubscribersPage() {
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [showForm, setShowForm] = useState(false);
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Subscriber[]>(`/api/subscribers?status=${statusFilter}&search=${encodeURIComponent(query)}`)
      .then(setSubscribers)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [statusFilter, query]);

  function validate() {
    const next: Record<string, string> = {};
    if (!email.trim()) next.email = "Email is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.email = "Enter a valid email.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!validate()) return;
    try {
      const subscriber = await apiFetch<Subscriber>("/api/subscribers", { method: "POST", body: JSON.stringify({ email, sourcePath: "dashboard" }) });
      setSubscribers((items) => [subscriber, ...items]);
      setEmail(""); setErrors({}); setShowForm(false);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to add subscriber");
    }
  }

  async function toggleStatus(id: string) {
    const subscriber = subscribers.find((s) => s.id === id);
    if (!subscriber) return;
    const nextStatus = subscriber.status === "subscribed" ? "unsubscribed" : "subscribed";
    setSubscribers((items) => items.map((s) => s.id === id ? { ...s, status: nextStatus } : s));
    try { await apiFetch("/api/subscribers", { method: "PUT", body: JSON.stringify({ id, status: nextStatus }) }); } catch { setSubscribers((items) => items.map((s) => s.id === id ? { ...s, status: subscriber.status } : s)); }
    setMenuOpenId(null);
  }

  async function removeSubscriber(id: string, email: string) {
    if (!confirm(`Remove subscriber ${email}?`)) return;
    try { await apiFetch("/api/subscribers", { method: "DELETE", body: JSON.stringify({ id }) }); setSubscribers((items) => items.filter((s) => s.id !== id)); } catch (error) { alert(error instanceof Error ? error.message : "Failed to remove"); }
    setMenuOpenId(null);
  }

  function exportCsv() {
    const rows = [["Email", "Status", "Consented At", "Source"], ...subscribers.map((s) => [s.email, s.status, new Date(s.consentedAt).toISOString(), s.sourcePath || ""])];
    const csv = rows.map((row) => row.map((cell) => '"' + String(cell).replaceAll('"', '""') + '"').join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "subscribers.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <AdminGuard>
    <main className="workspace-page">
      <header className="workspace-header">
        <div><p className="eyebrow">AUDIENCE</p><h1>Subscribers</h1><p className="subtitle">Manage newsletter subscribers and consent records.</p></div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="secondary-button" type="button" onClick={exportCsv}><Download size={16} /> Export CSV</button>
          <button className="primary-button" type="button" onClick={() => setShowForm(true)}><UserPlus size={18} /> Add subscriber</button>
        </div>
      </header>

      {showForm && (
        <section className="workspace-panel">
          <div className="panel-heading"><div><h2>Add subscriber</h2><p>Manually add a consented email.</p></div><button className="more-button" type="button" onClick={() => setShowForm(false)}><X size={18} /></button></div>
          <form onSubmit={submit} className="editor-form">
            <label className={errors.email ? "field-error" : undefined}>Email address<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="reader@example.com" />{errors.email && <span className="error-text">{errors.email}</span>}</label>
            <button className="primary-button" type="submit">Add subscriber</button>
          </form>
        </section>
      )}

      <section className="workspace-panel">
        <div className="article-controls">
          <label><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by email" /></label>
          <div className="status-tabs">
            {["All", "subscribed", "unsubscribed"].map((item) => (
              <button className={statusFilter === item ? "selected" : ""} onClick={() => setStatusFilter(item)} type="button" key={item}>{item === "All" ? "All" : item.charAt(0).toUpperCase() + item.slice(1)}</button>
            ))}
          </div>
        </div>
        {loading ? <div className="empty-state">Loading…</div> : subscribers.length === 0 ? (
          <div className="empty-state">No subscribers found.</div>
        ) : (
          <div className="editor-list">
            {subscribers.map((subscriber) => (
              <article className="editor-row" key={subscriber.id}>
                <div className="avatar"><Mail size={16} /></div>
                <div className="editor-info"><strong>{subscriber.email}</strong><span>Consented {new Date(subscriber.consentedAt).toLocaleDateString()}</span></div>
                <span className={`editor-status ${subscriber.status === "subscribed" ? "active" : "blocked"}`}>{subscriber.status}</span>
                <span className="editor-date">Source: {subscriber.sourcePath || "—"}</span>
                <div className="editor-menu-wrapper">
                  <button className="more-button" type="button" onClick={() => setMenuOpenId(menuOpenId === subscriber.id ? null : subscriber.id)}><MoreHorizontal size={19} /></button>
                  {menuOpenId === subscriber.id && (
                    <div className="editor-menu">
                      <button type="button" onClick={() => toggleStatus(subscriber.id)}>{subscriber.status === "subscribed" ? "Unsubscribe" : "Re-subscribe"}</button>
                      <button type="button" onClick={() => removeSubscriber(subscriber.id, subscriber.email)}><Trash2 size={14} /> Remove</button>
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
    </AdminGuard>
  );
}
