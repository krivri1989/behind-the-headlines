"use client";

import { CheckCircle2, Mail, MoreHorizontal, Plus, ShieldCheck, Trash2, UserPlus, X } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";

type Editor = { id: string; name: string; email: string; role: string; status: string; active: boolean; createdAt: string };

export default function EditorsPage() {
  const [editors, setEditors] = useState<Editor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "editor">("editor");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Editor[]>("/api/editors")
      .then(setEditors)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function validate() {
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = "Name is required.";
    if (!email.trim()) next.email = "Email is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.email = "Enter a valid email.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!validate()) return;
    try {
      const editor = await apiFetch<Editor>("/api/editors", { method: "POST", body: JSON.stringify({ name, email, role }) });
      setEditors((items) => [...items, editor]);
      setSaveSuccess(true);
      setTimeout(() => { setShowForm(false); setName(""); setEmail(""); setRole("editor"); setErrors({}); setSaveSuccess(false); }, 600);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to invite editor");
    }
  }

  async function toggleActive(id: string) {
    const editor = editors.find((e) => e.id === id);
    if (!editor) return;
    const nextActive = !editor.active;
    setEditors((items) => items.map((e) => e.id === id ? { ...e, active: nextActive, status: nextActive ? "Active" : "Blocked" } : e));
    try { await apiFetch("/api/editors", { method: "PUT", body: JSON.stringify({ id, active: nextActive }) }); } catch { setEditors((items) => items.map((e) => e.id === id ? { ...e, active: editor.active, status: editor.status } : e)); }
    setMenuOpenId(null);
  }

  async function removeEditor(id: string, name: string) {
    if (!confirm(`Remove ${name}?`)) return;
    try { await apiFetch("/api/editors", { method: "DELETE", body: JSON.stringify({ id }) }); setEditors((items) => items.filter((e) => e.id !== id)); } catch (error) { alert(error instanceof Error ? error.message : "Failed to remove"); }
    setMenuOpenId(null);
  }

  return (
    <main className="workspace-page">
      <header className="workspace-header">
        <div><p className="eyebrow">TEAM MANAGEMENT</p><h1>Editors</h1><p className="subtitle">Manage editorial team members and their access.</p></div>
        <button className="primary-button" type="button" onClick={() => setShowForm(true)}><UserPlus size={18} /> Invite editor</button>
      </header>

      {showForm && (
        <section className="workspace-panel">
          <div className="panel-heading"><div><h2>Invite editor</h2><p>Add a new team member.</p></div><button className="more-button" type="button" onClick={() => setShowForm(false)}><X size={18} /></button></div>
          <form onSubmit={submit} className="editor-form">
            <label className={errors.name ? "field-error" : undefined}>Full name<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Priya Sharma" />{errors.name && <span className="error-text">{errors.name}</span>}</label>
            <label className={errors.email ? "field-error" : undefined}>Email address<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="priya@behindtheheadlines.com" />{errors.email && <span className="error-text">{errors.email}</span>}</label>
            <label>Role<select value={role} onChange={(event) => setRole(event.target.value as "admin" | "editor")}><option value="editor">Editor</option><option value="admin">Administrator</option></select></label>
            <button className="primary-button" type="submit">{saveSuccess ? <CheckCircle2 size={17} /> : <Plus size={17} />}{saveSuccess ? "Invited" : "Send invite"}</button>
          </form>
        </section>
      )}

      <section className="workspace-panel">
        {loading ? <div className="empty-state">Loading…</div> : editors.length === 0 ? <div className="empty-state">No editors yet.</div> : (
          <div className="editor-list">
            {editors.map((editor) => (
              <article className="editor-row" key={editor.id}>
                <div className="avatar">{editor.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}</div>
                <div className="editor-info"><strong>{editor.name}</strong><span><Mail size={12} /> {editor.email}</span></div>
                <span className={`editor-role ${editor.role === "Administrator" ? "admin" : "editor"}`}>{editor.role === "Administrator" ? <ShieldCheck size={13} /> : null}{editor.role}</span>
                <span className={`editor-status ${editor.active ? "active" : "blocked"}`}>{editor.status}</span>
                <span className="editor-date">Joined {new Date(editor.createdAt).toLocaleDateString()}</span>
                <div className="editor-menu-wrapper">
                  <button className="more-button" type="button" onClick={() => setMenuOpenId(menuOpenId === editor.id ? null : editor.id)}><MoreHorizontal size={19} /></button>
                  {menuOpenId === editor.id && (
                    <div className="editor-menu">
                      <button type="button" onClick={() => toggleActive(editor.id)}>{editor.active ? "Block" : "Activate"}</button>
                      <button type="button" onClick={() => removeEditor(editor.id, editor.name)}><Trash2 size={14} /> Remove</button>
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
