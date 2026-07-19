"use client";

import { GripVertical, Plus, Trash2, X, Pencil, Check } from "lucide-react";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";

type MenuItem = { label: string; href: string; order: number; visible: boolean };
type MenuData = { id: string; location: "header" | "footer"; items: MenuItem[] };
type Category = { id: string; name: string; slug: string; visible: boolean };

export default function MenusPage() {
  const [location, setLocation] = useState<"header" | "footer">("header");
  const [header, setHeader] = useState<MenuItem[]>([]);
  const [footer, setFooter] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [dragged, setDragged] = useState<MenuItem | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [label, setLabel] = useState("");
  const [href, setHref] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingHref, setEditingHref] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");

  useEffect(() => {
    Promise.all([
      apiFetch<MenuData[]>("/api/menus"),
      apiFetch<Category[]>("/api/categories"),
    ])
      .then(([menus, cats]) => {
        const h = menus.find((m) => m.location === "header");
        const f = menus.find((m) => m.location === "footer");
        if (h) setHeader(h.items);
        if (f) setFooter(f.items);
        setCategories(cats.filter((c) => c.visible));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const items = location === "header" ? header : footer;
  const setItems = location === "header" ? setHeader : setFooter;

  async function saveMenu(loc: "header" | "footer", menuItems: MenuItem[]) {
    setSaving(true);
    try {
      await apiFetch("/api/menus", { method: "PUT", body: JSON.stringify({ location: loc, items: menuItems }) });
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to save menu");
    } finally {
      setSaving(false);
    }
  }

  const addToSelected = (item: MenuItem) => {
    if (!items.some((entry) => entry.href === item.href)) {
      const next = [...items, { ...item, order: items.length }];
      setItems(next);
      saveMenu(location, next);
    }
  };

  const reorder = (target: MenuItem) => {
    if (!dragged || dragged.href === target.href) return;
    setItems((current) => {
      const from = current.findIndex((item) => item.href === dragged.href);
      if (from < 0) return [...current, dragged];
      const next = [...current];
      const to = next.findIndex((item) => item.href === target.href);
      next.splice(to, 0, next.splice(from, 1)[0]);
      const reordered = next.map((item, index) => ({ ...item, order: index }));
      saveMenu(location, reordered);
      return reordered;
    });
    setDragged(null);
  };

  const removeItem = (item: MenuItem) => {
    const next = items.filter((entry) => entry.href !== item.href).map((entry, index) => ({ ...entry, order: index }));
    setItems(next);
    saveMenu(location, next);
  };

  const toggleVisible = (item: MenuItem) => {
    const next = items.map((entry) => entry.href === item.href ? { ...entry, visible: !entry.visible } : entry);
    setItems(next);
    saveMenu(location, next);
  };

  const startEdit = (item: MenuItem) => {
    setEditingHref(item.href);
    setEditLabel(item.label);
  };

  const cancelEdit = () => {
    setEditingHref(null);
    setEditLabel("");
  };

  const saveEdit = () => {
    if (!editingHref || !editLabel.trim()) return;
    const next = items.map((entry) => entry.href === editingHref ? { ...entry, label: editLabel.trim() } : entry);
    setItems(next);
    saveMenu(location, next);
    setEditingHref(null);
    setEditLabel("");
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const itemLabel = label.trim();
    const itemHref = href.trim();
    if (!itemLabel || !itemHref) return;
    const item: MenuItem = { label: itemLabel, href: itemHref.startsWith("/") || itemHref.startsWith("http") ? itemHref : `/${itemHref}`, order: items.length, visible: true };
    addToSelected(item);
    setLabel("");
    setHref("");
    setShowForm(false);
  };

  const addCategory = () => {
    const category = categories.find((c) => c.id === selectedCategory);
    if (!category) return;
    const item: MenuItem = { label: category.name, href: `/category/${category.slug}`, order: items.length, visible: true };
    addToSelected(item);
    setSelectedCategory("");
  };

  const allItems = [...header, ...footer];

  return (
    <main className="workspace-page">
      <header className="workspace-header">
        <div><p className="eyebrow">SITE NAVIGATION</p><h1>Menus</h1><p className="subtitle">Manage header and footer navigation.</p></div>
        <button className="primary-button" onClick={() => setShowForm(true)}><Plus size={18} /> Add menu item</button>
      </header>

      {showForm && (
        <form className="menu-form workspace-panel" onSubmit={submit}>
          <div className="panel-heading"><div><h2>Add menu item</h2><p>Add an item to the {location} menu.</p></div><button className="more-button" onClick={() => setShowForm(false)} type="button"><X size={18} /></button></div>
          <label>Menu label<input value={label} onChange={(event) => setLabel(event.target.value)} placeholder="e.g. Careers" required /></label>
          <label>URL or path<input value={href} onChange={(event) => setHref(event.target.value)} placeholder="e.g. /careers" required /></label>
          <button className="primary-button" type="submit">Save menu item</button>
        </form>
      )}

      {categories.length > 0 && (
        <div className="workspace-panel menu-category-panel">
          <div className="panel-heading"><div><h2>Add category to menu</h2><p>Quickly add a category page to the {location} menu.</p></div></div>
          <div className="menu-category-add">
            <label>
              Category
              <select value={selectedCategory} onChange={(event) => setSelectedCategory(event.target.value)}>
                <option value="">Select a category</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </label>
            <button className="primary-button" type="button" onClick={addCategory} disabled={!selectedCategory}>Add to {location}</button>
          </div>
        </div>
      )}

      <section className="menu-manager">
        <aside className="workspace-panel master-menu">
          <h2>Master menu list</h2>
          <p>All items across header and footer.</p>
          {loading ? <p className="empty-state">Loading…</p> : allItems.length === 0 ? <p className="empty-state">No menu items yet.</p> : (
            allItems.map((item, index) => (
              <div draggable onDragStart={() => setDragged(item)} key={`${item.href}-${index}`}>
                <GripVertical size={16} />
                <strong>{item.label}</strong>
                <small>{item.href}</small>
              </div>
            ))
          )}
        </aside>
        <section className="workspace-panel">
          <div className="status-tabs menu-tabs">
            <button className={location === "header" ? "selected" : ""} onClick={() => setLocation("header")}>Header menu</button>
            <button className={location === "footer" ? "selected" : ""} onClick={() => setLocation("footer")}>Footer menu</button>
          </div>
          <div className="menu-dropzone" onDragOver={(event) => event.preventDefault()} onDrop={() => { if (dragged) addToSelected(dragged); setDragged(null); }}>Drop a master menu item here to add it to the {location}.</div>
          {items.map((item, index) => (
            <div className="menu-row" draggable onDragStart={() => setDragged(item)} onDragOver={(event) => event.preventDefault()} onDrop={() => reorder(item)} key={`${item.href}-${index}`}>
              <GripVertical size={18} /><span>{index + 1}</span>
              {editingHref === item.href ? (
                <span className="menu-edit-wrap">
                  <input className="menu-edit-input" value={editLabel} onChange={(e) => setEditLabel(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") cancelEdit(); }} autoFocus />
                  <button className="menu-edit-save" onClick={saveEdit} type="button" aria-label="Save"><Check size={14} /></button>
                  <button className="menu-edit-cancel" onClick={cancelEdit} type="button" aria-label="Cancel"><X size={14} /></button>
                </span>
              ) : (
                <strong onDoubleClick={() => startEdit(item)}>{item.label}</strong>
              )}
              <span>{item.href}</span>
              {editingHref !== item.href && (
                <button className="menu-edit-btn" onClick={() => startEdit(item)} type="button" aria-label={`Edit ${item.label}`}><Pencil size={14} /></button>
              )}
              <button className={`switch ${item.visible ? "on" : ""}`} onClick={() => toggleVisible(item)} type="button" role="switch" aria-checked={item.visible}><span /></button>
              <button className="remove-menu-item" onClick={() => removeItem(item)} type="button" aria-label={`Remove ${item.label}`}><Trash2 size={16} /></button>
            </div>
          ))}
          {saving && <p className="category-notice">Saving…</p>}
        </section>
      </section>
    </main>
  );
}
