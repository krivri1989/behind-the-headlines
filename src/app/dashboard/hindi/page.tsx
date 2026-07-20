"use client";

import { Calendar, ExternalLink, Key, Languages, Loader2, Search, Terminal, AlertCircle } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { AdminGuard } from "@/components/admin-guard";

type HindiArticle = {
  slug: string;
  title: string;
  shortDesc: string;
  createdAt: string;
  imageUrl: string;
  imageCaption: string;
  tags: string[];
};

type LogLine = { id: number; message: string; type: "log" | "error" | "result" };

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) +
    " " + d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

function groupByTag(articles: HindiArticle[]): Map<string, HindiArticle[]> {
  const map = new Map<string, HindiArticle[]>();
  for (const a of articles) {
    // Use the first tag as the primary category, or "uncategorized"
    const tag = a.tags[0] || "uncategorized";
    if (!map.has(tag)) map.set(tag, []);
    map.get(tag)!.push(a);
  }
  return map;
}

async function readNdjsonStream(response: Response, onLine: (obj: Record<string, unknown>) => void) {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response body");
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      if (!line.trim()) continue;
      try { onLine(JSON.parse(line)); } catch { /* skip */ }
    }
  }
  if (buffer.trim()) { try { onLine(JSON.parse(buffer)); } catch { /* skip */ } }
}

function ArticleRow({ article }: { article: HindiArticle }) {
  return (
    <a
      href={`/dashboard/hindi/view?slug=${encodeURIComponent(article.slug)}`}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: "grid",
        gridTemplateColumns: "60px 1fr auto",
        gap: 14,
        alignItems: "center",
        padding: "12px 0",
        borderTop: "1px solid #f0eee9",
        textDecoration: "none",
        color: "inherit",
        cursor: "pointer",
      }}
      lang="hi"
    >
      {article.imageUrl ? (
        <img
          src={article.imageUrl.replace("https://iansportalimages.s3.amazonaws.com", "https://d2lnbwhcsmj8tp.cloudfront.net")}
          alt={article.title}
          style={{ width: 60, height: 60, objectFit: "cover", borderRadius: 5 }}
        />
      ) : (
        <div style={{ width: 60, height: 60, background: "#f0eee9", borderRadius: 5 }} />
      )}
      <div style={{ display: "grid", gap: 4 }}>
        <strong style={{ fontSize: 13, lineHeight: 1.3, fontFamily: "'Noto Sans Devanagari', sans-serif" }}>{article.title}</strong>
        <span style={{ fontSize: 11, color: "#94938d" }}>{formatDate(article.createdAt)}</span>
      </div>
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", justifyContent: "flex-end", alignItems: "center" }}>
        {article.tags.slice(0, 2).map((tag) => (
          <span key={tag} style={{ fontSize: 10, padding: "3px 8px", background: "#f3f2ee", borderRadius: 12, color: "#7a766e" }}>
            {tag}
          </span>
        ))}
        <ExternalLink size={14} color="#999991" style={{ marginLeft: 4 }} />
      </div>
    </a>
  );
}

export default function HindiPage() {
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 2);
    return d.toISOString().slice(0, 10);
  });
  const [toDate, setToDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [token, setToken] = useState("");
  const [scanning, setScanning] = useState(false);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [articles, setArticles] = useState<HindiArticle[]>([]);
  const [error, setError] = useState("");
  const logIdRef = useRef(0);
  const logEndRef = useRef<HTMLDivElement>(null);

  const grouped = useMemo(() => groupByTag(articles), [articles]);
  const tagNames = useMemo(() => [...grouped.keys()].sort(), [grouped]);
  const [filterTag, setFilterTag] = useState<string>("all");

  const filteredArticles = useMemo(() => {
    if (filterTag === "all") return articles;
    return articles.filter((a) => (a.tags[0] || "uncategorized") === filterTag);
  }, [articles, filterTag]);

  function addLog(message: string, type: LogLine["type"] = "log") {
    const id = logIdRef.current++;
    setLogs((prev) => [...prev, { id, message, type }]);
    setTimeout(() => logEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }), 50);
  }

  async function handleScan() {
    if (!token.trim()) { setError("Please enter the IANS token first."); return; }
    if (fromDate > toDate) { setError("From date cannot be after to date."); return; }
    setScanning(true);
    setError("");
    setArticles([]);
    setFilterTag("all");
    setLogs([]);
    logIdRef.current = 0;

    try {
      const params = new URLSearchParams({ mode: "list", from: fromDate, to: toDate, token: token.trim() });
      const res = await fetch(`/api/hindi?${params.toString()}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      await readNdjsonStream(res, (obj) => {
        const type = obj.type as string;
        if (type === "log") addLog(obj.message as string);
        else if (type === "error") { addLog(obj.message as string, "error"); setError(obj.message as string); }
        else if (type === "result") {
          setArticles((obj.articles as HindiArticle[]) || []);
          addLog(`\nLoaded ${((obj.articles as HindiArticle[]) || []).length} Hindi articles. Click any article to read it.`, "result");
        }
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to fetch Hindi news";
      addLog(msg, "error");
      setError(msg);
    } finally {
      setScanning(false);
    }
  }

  // Save token to localStorage so the view page (new tab) can access it
  function saveTokenToStorage() {
    if (token.trim()) {
      localStorage.setItem("ians_hindi_token", token.trim());
    }
  }

  return (
    <AdminGuard>
    <div className="workspace-page">
      <div className="workspace-header">
        <div>
          <p className="eyebrow">BROWSE</p>
          <h1>Hindi News</h1>
          <p className="subtitle">
            Browse IANS Hindi news articles. View-only — nothing is saved to the database.
          </p>
        </div>
      </div>

      {/* Scan controls */}
      <div className="workspace-panel" style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", gap: 16, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div style={{ display: "grid", gap: 6 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: "#8e8d86", letterSpacing: 1.1, textTransform: "uppercase" }}>
              From date
            </label>
            <div style={{ display: "flex", alignItems: "center", gap: 8, border: "1px solid #e2e0da", borderRadius: 5, padding: "9px 11px" }}>
              <Calendar size={16} color="#999991" />
              <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)}
                style={{ border: 0, outline: 0, fontSize: 13, color: "var(--ink)", background: "transparent" }}
                disabled={scanning} />
            </div>
          </div>

          <div style={{ display: "grid", gap: 6 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: "#8e8d86", letterSpacing: 1.1, textTransform: "uppercase" }}>
              To date
            </label>
            <div style={{ display: "flex", alignItems: "center", gap: 8, border: "1px solid #e2e0da", borderRadius: 5, padding: "9px 11px" }}>
              <Calendar size={16} color="#999991" />
              <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)}
                style={{ border: 0, outline: 0, fontSize: 13, color: "var(--ink)", background: "transparent" }}
                disabled={scanning} />
            </div>
          </div>

          <div style={{ display: "grid", gap: 6, flex: 1, minWidth: 280 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: "#8e8d86", letterSpacing: 1.1, textTransform: "uppercase" }}>
              IANS Token
            </label>
            <div style={{ display: "flex", alignItems: "center", gap: 8, border: "1px solid #e2e0da", borderRadius: 5, padding: "9px 11px" }}>
              <Key size={16} color="#999991" />
              <input type="password" value={token}
                onChange={(e) => setToken(e.target.value)}
                onBlur={saveTokenToStorage}
                placeholder="Paste IANS token here"
                style={{ border: 0, outline: 0, fontSize: 13, color: "var(--ink)", background: "transparent", width: "100%" }}
                disabled={scanning} autoComplete="off" />
            </div>
          </div>

          <button className="primary-button" onClick={handleScan}
            disabled={scanning || !fromDate || !token.trim()}
            style={{ opacity: scanning || !fromDate || !token.trim() ? 0.6 : 1 }}>
            {scanning ? <Loader2 size={16} className="spinning" /> : <Search size={16} />}
            {scanning ? "Scanning..." : "Scan Hindi News"}
          </button>
        </div>

        {error && (
          <div style={{ marginTop: 20, padding: "14px 20px", background: "#fdf0f0", borderRadius: 7, display: "flex", alignItems: "center", gap: 12, border: "1px solid #f0d6d6" }}>
            <AlertCircle size={20} style={{ color: "#c15048" }} />
            <div style={{ fontSize: 13, color: "#c15048", fontWeight: 600 }}>{error}</div>
          </div>
        )}
      </div>

      {/* Live log terminal */}
      {(scanning || logs.length > 0) && (
        <div className="workspace-panel" style={{ marginBottom: 24, padding: 0, overflow: "hidden" }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 8, padding: "10px 16px",
            background: "#1a1a1a", color: "#e0e0e0", fontSize: 11, fontWeight: 700,
            letterSpacing: 1.1, textTransform: "uppercase",
          }}>
            <Terminal size={14} />
            Process Log
            {scanning && <Loader2 size={12} className="spinning" style={{ marginLeft: "auto" }} />}
          </div>
          <div ref={logEndRef} style={{
            background: "#1e1e1e", color: "#d4d4d4", fontFamily: "'Menlo','Monaco','Courier New',monospace",
            fontSize: 12, lineHeight: 1.6, padding: 16, maxHeight: 400, overflowY: "auto",
            whiteSpace: "pre-wrap", wordBreak: "break-word",
          }}>
            {logs.map((log) => (
              <div key={log.id} style={{ color: log.type === "error" ? "#f48771" : log.type === "result" ? "#4ec9b0" : "#d4d4d4" }}>
                {log.message}
              </div>
            ))}
            {scanning && <div style={{ color: "#888", fontStyle: "italic" }}>Scanning...</div>}
          </div>
        </div>
      )}

      {/* Article list */}
      {articles.length > 0 && (
        <div className="workspace-panel">
          {/* Filter bar */}
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 20, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#8e8d86", letterSpacing: 1.1, textTransform: "uppercase" }}>
              Filter by category:
            </span>
            <button
              className="filter-button"
              onClick={() => setFilterTag("all")}
              style={filterTag === "all" ? { background: "var(--plum-soft)", color: "var(--plum)", borderColor: "var(--plum)" } : {}}
            >
              All ({articles.length})
            </button>
            {tagNames.map((tag) => (
              <button
                key={tag}
                className="filter-button"
                onClick={() => setFilterTag(tag)}
                style={filterTag === tag ? { background: "var(--plum-soft)", color: "var(--plum)", borderColor: "var(--plum)" } : {}}
              >
                {tag} ({grouped.get(tag)?.length || 0})
              </button>
            ))}
          </div>

          {/* Category groups (when showing all) */}
          {filterTag === "all" && tagNames.map((tagName) => {
            const groupArticles = grouped.get(tagName) || [];
            return (
              <div key={tagName} style={{ marginBottom: 24 }}>
                <div style={{
                  display: "flex", alignItems: "center", gap: 10,
                  marginBottom: 10, paddingBottom: 8, borderBottom: "1px solid var(--line)",
                }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "var(--plum)" }}>{tagName}</span>
                  <span style={{ fontSize: 11, color: "var(--muted)" }}>{groupArticles.length} articles</span>
                </div>
                {groupArticles.map((article) => (
                  <ArticleRow key={article.slug} article={article} />
                ))}
              </div>
            );
          })}

          {/* Filtered view (single category) */}
          {filterTag !== "all" && (
            <div>
              {filteredArticles.map((article) => (
                <ArticleRow key={article.slug} article={article} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {!scanning && articles.length === 0 && !error && logs.length === 0 && (
        <div className="workspace-panel" style={{ textAlign: "center", padding: "60px 20px" }}>
          <Languages size={48} style={{ color: "#d6d5ce", margin: "0 auto 16px" }} />
          <h2 style={{ font: '700 18px "Playfair Display",Georgia,serif', margin: "0 0 8px" }}>No articles loaded</h2>
          <p style={{ color: "var(--muted)", fontSize: 13, margin: "0 0 4px" }}>
            Select a date range and click &quot;Scan Hindi News&quot; to browse IANS Hindi articles.
          </p>
          <p style={{ color: "#94938d", fontSize: 11, margin: "4px 0 0" }}>
            View-only — articles are not saved to the database.
          </p>
        </div>
      )}
    </div>
    </AdminGuard>
  );
}
