"use client";

import { GripVertical, MoreHorizontal, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { AdminGuard } from "@/components/admin-guard";

type Category = { id: string; name: string; slug: string; description?: string; visible: boolean; order: number };

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch<Category[]>("/api/categories")
      .then(setCategories)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function addCategory(event: React.FormEvent) {
    event.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setSaving(true);
    try {
      const category = await apiFetch<Category>("/api/categories", { method: "POST", body: JSON.stringify({ name }) });
      setCategories((items) => [...items, category]);
      setNewName("");
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to add category");
    } finally {
      setSaving(false);
    }
  }

  async function toggleVisibility(id: string) {
    const category = categories.find((c) => c.id === id);
    if (!category) return;
    setCategories((items) => items.map((c) => c.id === id ? { ...c, visible: !c.visible } : c));
    try {
      await apiFetch(`/api/categories`, { method: "PUT", body: JSON.stringify({ id, visible: !category.visible }) });
    } catch { setCategories((items) => items.map((c) => c.id === id ? { ...c, visible: category.visible } : c)); }
  }

  const reorder = (targetId: string) => {
    if (!draggedId || draggedId === targetId) return;
    setCategories((items) => {
      const next = [...items];
      const from = next.findIndex((c) => c.id === draggedId);
      const to = next.findIndex((c) => c.id === targetId);
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
    setDraggedId(null);
  };

  async function deleteCategory(id: string, name: string) {
    if (!confirm(`Remove ${name}?`)) return;
    try {
      await apiFetch("/api/categories", { method: "DELETE", body: JSON.stringify({ id }) });
      setCategories((items) => items.filter((c) => c.id !== id));
      if (selectedId === id) setSelectedId(null);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to delete category");
    }
  }

  const selected = selectedId ? categories.find((c) => c.id === selectedId) : null;

  return (
    <AdminGuard>
    <main className="workspace-page">
      <header className="workspace-header">
        <div>
          <p className="eyebrow">CONTENT STRUCTURE</p>
          <h1>Categories</h1>
          <p className="subtitle">Control where articles appear across your navigation and portal.</p>
        </div>
        <form className="add-inline" onSubmit={addCategory}>
          <input value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="Category name" disabled={saving} />
          <button className="primary-button" type="submit" disabled={saving}><Plus size={18} /> Add category</button>
        </form>
      </header>

      <section className="workspace-panel">
        {loading ? <div className="empty-state">Loading categories…</div> : categories.length === 0 ? (
          <div className="empty-state">No categories yet. Add one above.</div>
        ) : (
          <>
            <div className="category-notice">Drag categories to set their display order. Hidden categories will not appear in public navigation.</div>
            <div className="category-list">
              {categories.map((category, index) => (
                <article className="category-row" draggable onDragStart={() => setDraggedId(category.id)} onDragOver={(event) => event.preventDefault()} onDrop={() => reorder(category.id)} key={category.id}>
                  <GripVertical size={18} />
                  <span className="order-number">{String(index + 1).padStart(2, "0")}</span>
                  <div><strong>{category.name}</strong><span>/{category.slug}</span></div>
                  <button className={`switch ${category.visible ? "on" : ""}`} onClick={() => toggleVisibility(category.id)} type="button" role="switch" aria-checked={category.visible}><span /></button>
                  <button className="more-button" onClick={() => setSelectedId(category.id)} type="button" aria-label={`Edit ${category.name}`}><MoreHorizontal size={19} /></button>
                </article>
              ))}
            </div>
          </>
        )}
      </section>

      {selected && (
        <section className="workspace-panel">
          <div className="panel-heading">
            <div><h2>Edit {selected.name}</h2><p>Category metadata and SEO preview fields.</p></div>
            <button className="remove-menu-item" onClick={() => deleteCategory(selected.id, selected.name)}><Trash2 size={16} /> Remove</button>
          </div>
          <div className="settings-grid">
            <label>Name<input defaultValue={selected.name} /></label>
            <label>Slug<input defaultValue={selected.slug} /></label>
            <label>Description<textarea rows={3} defaultValue={selected.description || ""} placeholder="Category description" /></label>
            <label>Parent category<select><option>None</option>{categories.filter((c) => c.id !== selected.id).map((c) => <option key={c.id}>{c.name}</option>)}</select></label>
            <label>SEO title<input placeholder="Optional SEO title" /></label>
            <label>Category image<select><option>None selected</option></select></label>
          </div>
        </section>
      )}
    </main>
    </AdminGuard>
  );
}
