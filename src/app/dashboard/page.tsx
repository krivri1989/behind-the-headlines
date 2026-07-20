"use client";

import {
  Bell, ChevronDown, CircleHelp, FileText, FolderTree, LayoutDashboard,
  LogOut, Menu, MessageSquare, MoreHorizontal, Newspaper, Plus, Radio, Search, Settings, Tags, Users,
  Activity, RefreshCw, Languages, Megaphone,
} from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api-client";

type SessionUser = { id: string; email: string; name: string; role: "admin" | "editor" };
type Article = { id: string; title: string; status: string; author: string; categories: string[]; updatedAt: string };
type WorkerStatus = {
  status: "running" | "stopped";
  lastHeartbeatAgo: string | null;
  processed: number;
  failed: number;
  queue: { pending: number; processing: number; delayed: number };
};

type DashboardStats = {
  articles: { total: number; published: number; draft: number; archived: number };
  rssSources: { total: number; active: number; errors: number };
  subscribers: { total: number; subscribed: number };
  editors: number;
  categories: number;
};

const adminNavigation = [
  { label: "Overview", icon: LayoutDashboard, active: true },
  { label: "Articles", icon: Newspaper, href: "/dashboard/articles" },
  { label: "Media library", icon: FileText, href: "/dashboard/media" },
  { label: "Categories", icon: FolderTree, href: "/dashboard/categories" },
  { label: "Tags", icon: Tags, href: "/dashboard/tags" },
  { label: "Menus", icon: Menu, href: "/dashboard/menus" },
  { label: "Pages", icon: FileText, href: "/dashboard/pages" },
  { label: "RSS sources", icon: Radio, href: "/dashboard/rss-sources" },
  { label: "Recover", icon: RefreshCw, href: "/dashboard/recover" },
  { label: "Hindi", icon: Languages, href: "/dashboard/hindi" },
  { label: "Editors", icon: Users, href: "/dashboard/editors" },
  { label: "Subscribers", icon: Users, href: "/dashboard/subscribers" },
  { label: "Comments", icon: MessageSquare, href: "/dashboard/comments" },
  { label: "RSS Audit", icon: FileText, href: "/dashboard/audit-logs" },
  { label: "Advertisements", icon: Megaphone, href: "/dashboard/advertisements" },
];

const editorNavigation = [
  { label: "Overview", icon: LayoutDashboard, active: true },
  { label: "Articles", icon: Newspaper, href: "/dashboard/articles" },
  { label: "Media library", icon: FileText, href: "/dashboard/media" },
];

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [articles, setArticles] = useState<Article[]>([]);
  const [worker, setWorker] = useState<WorkerStatus | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    apiFetch<{ user: SessionUser | null }>("/api/auth/session")
      .then((data) => {
        if (!data.user) { router.replace("/login"); return; }
        setUser(data.user);
        setLoading(false);
        return Promise.all([
          apiFetch<{ articles: Article[] }>("/api/articles?limit=10"),
          apiFetch<DashboardStats>("/api/dashboard/stats"),
        ]);
      })
      .then((data) => { if (data) { setArticles(data[0].articles); setStats(data[1]); } })
      .catch(() => { router.replace("/login"); });
  }, [router]);

  useEffect(() => {
    if (!user || user.role !== "admin") return;
    const fetchWorker = () => apiFetch<WorkerStatus>("/api/worker").then(setWorker).catch(() => {});
    fetchWorker();
    const interval = setInterval(fetchWorker, 15_000);
    return () => clearInterval(interval);
  }, [user]);

  const logout = useCallback(async () => {
    await apiFetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }, [router]);

  if (loading) return <main className="app-shell"><div className="dashboard-content"><p className="empty-state">Loading…</p></div></main>;

  const isEditor = user?.role === "editor";
  const navigation = isEditor ? editorNavigation : adminNavigation;
  const visibleArticles = articles.filter((article) => article.title.toLowerCase().includes(query.toLowerCase()));
  const initials = user?.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "U";

  return (
    <main className="app-shell">
      {menuOpen && <button className="menu-overlay" aria-label="Close menu" onClick={() => setMenuOpen(false)} type="button" />}
      <aside className={`sidebar ${menuOpen ? "open" : ""}`}>
        <a className="brand" href="/dashboard" aria-label="Behind The Headlines dashboard">
          <span className="brand-mark">BH</span>
          <span>Behind<br /><strong>The Headlines</strong></span>
        </a>
        <div className="workspace-label">EDITORIAL WORKSPACE</div>
        <nav aria-label="Primary dashboard navigation">
          {navigation.map(({ label, icon: Icon, active, href }) => href ? (
            <Link className={`nav-item ${active ? "active" : ""}`} href={href} key={label}>
              <Icon size={18} strokeWidth={active ? 2.2 : 1.8} />{label}
            </Link>
          ) : (
            <button className={`nav-item ${active ? "active" : ""}`} key={label} type="button"><Icon size={18} strokeWidth={active ? 2.2 : 1.8} />{label}</button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          {!isEditor && <Link className="nav-item" href="/dashboard/settings"><Settings size={18} /> Settings</Link>}
          <button className="nav-item" type="button"><CircleHelp size={18} /> Help center</button>
          <button className="nav-item" onClick={logout} type="button"><LogOut size={18} /> Log out</button>
          <div className="user-card">
            <div className="avatar">{initials}</div>
            <div><strong>{user?.name}</strong><span>{isEditor ? "Editor" : "Administrator"}</span></div>
            <ChevronDown size={16} />
          </div>
        </div>
      </aside>

      <section className="content-area">
        <header className="topbar">
          <button className="mobile-menu" aria-label="Open menu" onClick={() => setMenuOpen(true)} type="button"><Menu size={22} /></button>
          <label className="global-search"><Search size={18} /><input placeholder="Search articles, media, and more" /></label>
          <div className="topbar-actions"><button className="icon-button" type="button" aria-label="Notifications"><Bell size={19} /><span /></button><button className="visit-site" type="button">View site</button></div>
        </header>

        <div className="dashboard-content">
          <section className="page-heading">
            <div><p className="eyebrow">DASHBOARD</p><h1>Welcome, {user?.name.split(" ")[0]}.</h1><p className="subtitle">Here is what is happening across your newsroom.</p></div>
            <Link className="primary-button" href="/dashboard/articles/new"><Plus size={18} /> Create article</Link>
          </section>

          <section className="metrics" aria-label="Newsroom metrics">
            <article className="metric-card"><span className="metric-icon plum"><Newspaper size={20} /></span><p>Published articles</p><strong>{stats?.articles.published ?? "—"}</strong><small>Loaded from database</small></article>
            <article className="metric-card"><span className="metric-icon gold"><Users size={20} /></span><p>Total articles</p><strong>{stats?.articles.total ?? "—"}</strong><small>All statuses</small></article>
            <article className="metric-card"><span className="metric-icon blue"><Radio size={20} /></span><p>RSS sources</p><strong>{stats?.rssSources.total ?? "—"}</strong><small>{stats ? `${stats.rssSources.active} active` : "Configure in RSS sources"}</small></article>
            <article className="metric-card"><span className="metric-icon green"><FileText size={20} /></span><p>Drafts</p><strong>{stats?.articles.draft ?? "—"}</strong><small>In progress</small></article>
          </section>

          <section className="dashboard-grid">
            <article className="panel article-panel">
              <div className="panel-heading"><div><h2>Recent articles</h2><p>Latest activity from your editorial team</p></div><Link className="text-button" href="/dashboard/articles">View all articles</Link></div>
              <div className="list-toolbar"><label><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search articles" /></label></div>
              <div className="article-table" role="table">
                <div className="table-head" role="row"><span>ARTICLE</span><span>AUTHOR</span><span>STATUS</span><span>UPDATED</span><span /></div>
                {visibleArticles.length === 0 ? (
                  <div className="empty-state">No articles yet. Create your first article.</div>
                ) : visibleArticles.map((article) => (
                  <Link className="table-row" href={`/dashboard/articles/${article.id}`} key={article.id} role="row" style={{ textDecoration: "none", color: "inherit" }}>
                    <div><strong>{article.title}</strong><span className="category">{article.categories.join(", ") || "Uncategorized"}</span></div>
                    <span>{article.author}</span>
                    <span className={`status ${article.status}`}>{article.status}</span>
                    <span>{new Date(article.updatedAt).toLocaleDateString()}</span>
                    <span className="more-button"><MoreHorizontal size={19} /></span>
                  </Link>
                ))}
              </div>
            </article>

            <div className="side-panels">
              {!isEditor && worker && (
                <article className="panel">
                  <div className="panel-heading">
                    <div><h2>Worker status (CRON Job)</h2><p>RSS background importer</p></div>
                    <span className={`source-status ${worker.status === "running" ? "good" : "error"}`}>
                      {worker.status === "running" ? "Running" : "Stopped"}
                    </span>
                  </div>
                  <div className="rss-summary">
                    <div className={`health-ring ${worker.status === "running" ? "" : "error"}`}>
                      <Activity size={20} />
                    </div>
                    <div>
                      <strong>{worker.processed} jobs processed</strong>
                      <p>{worker.failed} failed · {worker.lastHeartbeatAgo || "never"}</p>
                    </div>
                  </div>
                  <div className="source-list">
                    <div><span className="source-dot good" />Queue pending <small>{worker.queue.pending}</small></div>
                    <div><span className="source-dot waiting" />Processing <small>{worker.queue.processing}</small></div>
                    <div><span className="source-dot paused" />Delayed retries <small>{worker.queue.delayed}</small></div>
                  </div>
                </article>
              )}
              <article className="panel quick-panel">
                <div className="panel-heading"><div><h2>Quick actions</h2><p>Common newsroom tasks</p></div></div>
                <div className="quick-actions">
                  <Link href="/dashboard/articles/new" style={{ textDecoration: "none" }}><button type="button"><Plus size={18} /> New article</button></Link>
                  {!isEditor && <Link href="/dashboard/rss-sources" style={{ textDecoration: "none" }}><button type="button"><Radio size={18} /> Add RSS source</button></Link>}
                  {!isEditor && <Link href="/dashboard/editors" style={{ textDecoration: "none" }}><button type="button"><Users size={18} /> Invite editor</button></Link>}
                  {!isEditor && <Link href="/dashboard/menus" style={{ textDecoration: "none" }}><button type="button"><Menu size={18} /> Edit navigation</button></Link>}
                </div>
              </article>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
