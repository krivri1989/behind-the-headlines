"use client";
import { Plus, Search, Tags, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";

type Tag = { id: string; name: string; slug: string };

export default function TagsPage() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [newName, setNewName] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch<Tag[]>("/api/tags")
      .then(setTags)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function addTag(event: React.FormEvent) {
    event.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setSaving(true);
    try {
      const tag = await apiFetch<Tag>("/api/tags", { method: "POST", body: JSON.stringify({ name }) });
      setTags((items) => [...items, tag]);
      setNewName("");
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to add tag");
    } finally {
      setSaving(false);
    }
  }

  async function removeTag(id: string, name: string) {
    if (!confirm(`Remove ${name}?`)) return;
    try {
      await apiFetch("/api/tags", { method: "DELETE", body: JSON.stringify({ id }) });
      setTags((items) => items.filter((t) => t.id !== id));
      if (selectedId === id) setSelectedId(null);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to delete tag");
    }
  }

  const visible = tags.filter((tag) => tag.name.toLowerCase().includes(query.toLowerCase()));
  const current = tags.find((tag) => tag.id === selectedId);

  return (
    <main className="workspace-page">
      <header className="workspace-header">
        <div><p className="eyebrow">CONTENT STRUCTURE</p><h1>Tags</h1><p className="subtitle">Group related stories for search and discovery.</p></div>
        <form className="add-inline" onSubmit={addTag}>
          <input value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="Tag name" disabled={saving} />
          <button className="primary-button" type="submit" disabled={saving}><Plus size={18} /> Add tag</button>
        </form>
      </header>
      <section className="workspace-panel">
        <div className="media-toolbar"><label><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search tags" /></label></div>
        {loading ? <div className="empty-state">Loading tags…</div> : visible.length === 0 ? (
          <div className="empty-state">No tags found.</div>
        ) : (
          <div className="tag-grid">
            {visible.map((tag) => (
              <article onClick={() => setSelectedId(tag.id)} key={tag.id} className={selectedId === tag.id ? "selected" : ""}>
                <Tags size={17} />
                <div><strong>{tag.name}</strong><span>/{tag.slug}</span></div>
                <button className="more-button" onClick={(event) => { event.stopPropagation(); removeTag(tag.id, tag.name); }}><Trash2 size={16} /></button>
              </article>
            ))}
          </div>
        )}
      </section>
      {current && (
        <section className="workspace-panel">
          <div className="panel-heading"><div><h2>Edit {current.name}</h2><p>Tag metadata.</p></div></div>
          <div className="settings-grid">
            <label>Tag name<input defaultValue={current.name} /></label>
            <label>Tag slug<input defaultValue={current.slug} /></label>
          </div>
        </section>
      )}
    </main>
  );
}
