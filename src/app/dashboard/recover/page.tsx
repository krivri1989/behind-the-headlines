"use client";

import { Calendar, CheckCircle2, Database, Key, Loader2, RefreshCw, Save, Search, XCircle, AlertCircle, Terminal } from "lucide-react";
import { useMemo, useRef, useState } from "react";

type RecoverableArticle = {
  slug: string;
  sourceUrl: string;
  title: string;
  excerpt: string;
  sourceName: string;
  createdAt: string;
  imageUrl: string;
  imageCaption: string;
  tags: string[];
};

type LogLine = {
  id: number;
  message: string;
  type: "log" | "error" | "result";
};

type SaveResult = {
  imported: Array<{ slug: string; title: string }>;
  skipped: Array<{ slug: string; title: string; reason: string }>;
  failed: Array<{ slug: string; title: string; error: string }>;
};

function groupBySource(articles: RecoverableArticle[]): Map<string, RecoverableArticle[]> {
  const groups = new Map<string, RecoverableArticle[]>();
  for (const a of articles) {
    if (!groups.has(a.sourceName)) groups.set(a.sourceName, []);
    groups.get(a.sourceName)!.push(a);
  }
  return groups;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) +
    " " + d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

/**
 * Reads an NDJSON stream from a fetch Response, calling onLine for each parsed JSON object.
 */
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
      try {
        onLine(JSON.parse(line));
      } catch { /* skip malformed lines */ }
    }
  }
  if (buffer.trim()) {
    try { onLine(JSON.parse(buffer)); } catch { /* skip */ }
  }
}

export default function RecoverPage() {
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 2);
    return d.toISOString().slice(0, 10);
  });
  const [toDate, setToDate] = useState(() => {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  });
  const [token, setToken] = useState("");
  const [scanning, setScanning] = useState(false);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [articles, setArticles] = useState<RecoverableArticle[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filterSource, setFilterSource] = useState<string>("all");
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<SaveResult | null>(null);
  const [error, setError] = useState("");
  const logIdRef = useRef(0);
  const logEndRef = useRef<HTMLDivElement>(null);

  const grouped = useMemo(() => groupBySource(articles), [articles]);
  const sourceNames = useMemo(() => [...grouped.keys()].sort(), [grouped]);

  const filteredArticles = useMemo(() => {
    if (filterSource === "all") return articles;
    return articles.filter((a) => a.sourceName === filterSource);
  }, [articles, filterSource]);

  function addLog(message: string, type: LogLine["type"] = "log") {
    const id = logIdRef.current++;
    setLogs((prev) => [...prev, { id, message, type }]);
    // Auto-scroll to bottom
    setTimeout(() => {
      logEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }, 50);
  }

  async function handleScan() {
    if (!token.trim()) {
      setError("Please enter the IANS token first.");
      return;
    }
    if (fromDate > toDate) {
      setError("From date cannot be after to date.");
      return;
    }
    setScanning(true);
    setError("");
    setArticles([]);
    setSelected(new Set());
    setSaveResult(null);
    setLogs([]);
    logIdRef.current = 0;

    try {
      const params = new URLSearchParams({ from: fromDate, to: toDate, token: token.trim() });
      const res = await fetch(`/api/recover?${params.toString()}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      await readNdjsonStream(res, (obj) => {
        const type = obj.type as string;
        if (type === "log") {
          addLog(obj.message as string);
        } else if (type === "error") {
          addLog(obj.message as string, "error");
          setError(obj.message as string);
        } else if (type === "result") {
          const arts = (obj.articles as RecoverableArticle[]) || [];
          setArticles(arts);
          addLog(`\nLoaded ${arts.length} articles for review. Scroll down to select and save.`, "result");
        }
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to scan IANS API";
      addLog(msg, "error");
      setError(msg);
    } finally {
      setScanning(false);
    }
  }

  function toggleSelect(slug: string) {
    const next = new Set(selected);
    if (next.has(slug)) next.delete(slug);
    else next.add(slug);
    setSelected(next);
  }

  function selectAll() {
    setSelected(new Set(filteredArticles.map((a) => a.slug)));
  }

  function selectNone() {
    setSelected(new Set());
  }

  function selectBySource(sourceName: string) {
    const next = new Set(selected);
    for (const a of (grouped.get(sourceName) || [])) {
      next.add(a.slug);
    }
    setSelected(next);
  }

  async function handleSave() {
    if (selected.size === 0) return;
    setSaving(true);
    setError("");
    setSaveResult(null);
    addLog(`Starting save of ${selected.size} articles...`, "log");

    try {
      const toSave = articles.filter((a) => selected.has(a.slug));
      const imageMap: Record<string, string> = {};
      for (const a of toSave) {
        if (a.imageUrl) imageMap[a.slug] = a.imageUrl;
      }

      const res = await fetch("/api/recover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          articles: toSave.map((a) => ({ slug: a.slug, sourceName: a.sourceName, title: a.title })),
          imageMap,
          token: token.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      let result: SaveResult | null = null;
      await readNdjsonStream(res, (obj) => {
        const type = obj.type as string;
        if (type === "log") {
          addLog(obj.message as string);
        } else if (type === "error") {
          addLog(obj.message as string, "error");
          setError(obj.message as string);
        } else if (type === "result") {
          result = {
            imported: (obj.imported as SaveResult["imported"]) || [],
            skipped: (obj.skipped as SaveResult["skipped"]) || [],
            failed: (obj.failed as SaveResult["failed"]) || [],
          };
        }
      });

      if (result) {
        const r: SaveResult = result;
        setSaveResult(r);
        // Remove successfully imported articles from the list
        const importedSlugs = new Set(r.imported.map((i: { slug: string }) => i.slug));
        if (importedSlugs.size > 0) {
          setArticles((prev) => prev.filter((a) => !importedSlugs.has(a.slug)));
          setSelected(new Set());
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to save articles";
      addLog(msg, "error");
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="workspace-page">
      <div className="workspace-header">
        <div>
          <p className="eyebrow">TOOLS</p>
          <h1>Recover Articles</h1>
          <p className="subtitle">
            Fetch missed articles directly from the IANS CMS API when the RSS worker has been down.
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
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                style={{ border: 0, outline: 0, fontSize: 13, color: "var(--ink)", background: "transparent" }}
                disabled={scanning || saving}
              />
            </div>
          </div>

          <div style={{ display: "grid", gap: 6 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: "#8e8d86", letterSpacing: 1.1, textTransform: "uppercase" }}>
              To date
            </label>
            <div style={{ display: "flex", alignItems: "center", gap: 8, border: "1px solid #e2e0da", borderRadius: 5, padding: "9px 11px" }}>
              <Calendar size={16} color="#999991" />
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                style={{ border: 0, outline: 0, fontSize: 13, color: "var(--ink)", background: "transparent" }}
                disabled={scanning || saving}
              />
            </div>
          </div>

          <div style={{ display: "grid", gap: 6, flex: 1, minWidth: 280 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: "#8e8d86", letterSpacing: 1.1, textTransform: "uppercase" }}>
              IANS Token
            </label>
            <div style={{ display: "flex", alignItems: "center", gap: 8, border: "1px solid #e2e0da", borderRadius: 5, padding: "9px 11px" }}>
              <Key size={16} color="#999991" />
              <input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Paste IANS token here"
                style={{ border: 0, outline: 0, fontSize: 13, color: "var(--ink)", background: "transparent", width: "100%" }}
                disabled={scanning || saving}
                autoComplete="off"
              />
            </div>
          </div>

          <button
            className="primary-button"
            onClick={handleScan}
            disabled={scanning || saving || !fromDate || !token.trim()}
            style={{ opacity: scanning || saving || !fromDate || !token.trim() ? 0.6 : 1 }}
          >
            {scanning ? <Loader2 size={16} className="spinning" /> : <Search size={16} />}
            {scanning ? "Scanning..." : "Scan IANS API"}
          </button>

          {articles.length > 0 && (
            <div style={{ marginLeft: "auto", display: "flex", gap: 12, alignItems: "center" }}>
              <span style={{ fontSize: 12, color: "var(--muted)" }}>
                {selected.size} selected of {articles.length} articles
              </span>
              <button
                className="primary-button"
                onClick={handleSave}
                disabled={saving || selected.size === 0}
                style={{ opacity: saving || selected.size === 0 ? 0.6 : 1, background: "var(--green)" }}
              >
                {saving ? <Loader2 size={16} className="spinning" /> : <Save size={16} />}
                {saving ? `Saving...` : `Save Selected (${selected.size})`}
              </button>
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div style={{ marginTop: 20, padding: "14px 20px", background: "#fdf0f0", borderRadius: 7, display: "flex", alignItems: "center", gap: 12, border: "1px solid #f0d6d6" }}>
            <AlertCircle size={20} style={{ color: "#c15048" }} />
            <div style={{ fontSize: 13, color: "#c15048", fontWeight: 600 }}>{error}</div>
          </div>
        )}

        {/* Save results summary */}
        {saveResult && (
          <div style={{ marginTop: 20, display: "grid", gap: 10 }}>
            {saveResult.imported.length > 0 && (
              <div style={{ padding: "14px 20px", background: "#e8f3ed", borderRadius: 7, display: "flex", alignItems: "flex-start", gap: 12 }}>
                <CheckCircle2 size={20} style={{ color: "#387957", flexShrink: 0, marginTop: 1 }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#387957" }}>
                    Successfully imported {saveResult.imported.length} articles
                  </div>
                </div>
              </div>
            )}
            {saveResult.skipped.length > 0 && (
              <div style={{ padding: "12px 20px", background: "#f3eee6", borderRadius: 7, display: "flex", alignItems: "center", gap: 12 }}>
                <AlertCircle size={18} style={{ color: "#947246" }} />
                <div style={{ fontSize: 12, color: "#947246" }}>Skipped {saveResult.skipped.length} (duplicates)</div>
              </div>
            )}
            {saveResult.failed.length > 0 && (
              <div style={{ padding: "12px 20px", background: "#fdf0f0", borderRadius: 7, display: "flex", alignItems: "center", gap: 12 }}>
                <XCircle size={18} style={{ color: "#c15048" }} />
                <div style={{ fontSize: 12, color: "#c15048" }}>Failed {saveResult.failed.length} articles</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Live log terminal */}
      {(scanning || saving || logs.length > 0) && (
        <div className="workspace-panel" style={{ marginBottom: 24, padding: 0, overflow: "hidden" }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 8, padding: "10px 16px",
            background: "#1a1a1a", color: "#e0e0e0", fontSize: 11, fontWeight: 700,
            letterSpacing: 1.1, textTransform: "uppercase",
          }}>
            <Terminal size={14} />
            Process Log
            {(scanning || saving) && <Loader2 size={12} className="spinning" style={{ marginLeft: "auto" }} />}
          </div>
          <div
            ref={logEndRef}
            style={{
              background: "#1e1e1e", color: "#d4d4d4", fontFamily: "'Menlo', 'Monaco', 'Courier New', monospace",
              fontSize: 12, lineHeight: 1.6, padding: 16, maxHeight: 400, overflowY: "auto",
              whiteSpace: "pre-wrap", wordBreak: "break-word",
            }}
          >
            {logs.map((log) => (
              <div
                key={log.id}
                style={{
                  color: log.type === "error" ? "#f48771" : log.type === "result" ? "#4ec9b0" : "#d4d4d4",
                }}
              >
                {log.message}
              </div>
            ))}
            {(scanning || saving) && (
              <div style={{ color: "#888", fontStyle: "italic" }}>
                {scanning ? "Scanning..." : "Saving..."}
              </div>
            )}
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
              onClick={() => setFilterSource("all")}
              style={filterSource === "all" ? { background: "var(--plum-soft)", color: "var(--plum)", borderColor: "var(--plum)" } : {}}
            >
              All ({articles.length})
            </button>
            {sourceNames.map((name) => (
              <button
                key={name}
                className="filter-button"
                onClick={() => setFilterSource(name)}
                style={filterSource === name ? { background: "var(--plum-soft)", color: "var(--plum)", borderColor: "var(--plum)" } : {}}
              >
                {name.replace("IANS - ", "")} ({grouped.get(name)?.length || 0})
              </button>
            ))}
            <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
              <button className="text-button" onClick={selectAll}>Select all</button>
              <button className="text-button" onClick={selectNone}>Select none</button>
            </div>
          </div>

          {/* Category groups with select-by-category */}
          {filterSource === "all" && sourceNames.map((sourceName) => {
            const groupArticles = grouped.get(sourceName) || [];
            const groupSelected = groupArticles.filter((a) => selected.has(a.slug)).length;
            return (
              <div key={sourceName} style={{ marginBottom: 24 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, paddingBottom: 8, borderBottom: "1px solid var(--line)" }}>
                  <button
                    className="text-button"
                    onClick={() => selectBySource(sourceName)}
                    style={{ display: "flex", alignItems: "center", gap: 6 }}
                  >
                    <RefreshCw size={12} />
                    Select all in {sourceName}
                  </button>
                  <span style={{ fontSize: 11, color: "var(--muted)" }}>
                    {groupSelected}/{groupArticles.length} selected
                  </span>
                </div>
                {groupArticles.map((article) => (
                  <ArticleRow
                    key={article.slug}
                    article={article}
                    checked={selected.has(article.slug)}
                    onToggle={() => toggleSelect(article.slug)}
                  />
                ))}
              </div>
            );
          })}

          {/* Filtered view (single category) */}
          {filterSource !== "all" && (
            <div>
              {filteredArticles.map((article) => (
                <ArticleRow
                  key={article.slug}
                  article={article}
                  checked={selected.has(article.slug)}
                  onToggle={() => toggleSelect(article.slug)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Empty state when no scan has been done */}
      {!scanning && articles.length === 0 && !error && logs.length === 0 && (
        <div className="workspace-panel" style={{ textAlign: "center", padding: "60px 20px" }}>
          <Database size={48} style={{ color: "#d6d5ce", margin: "0 auto 16px" }} />
          <h2 style={{ font: '700 18px "Playfair Display",Georgia,serif', margin: "0 0 8px" }}>No articles loaded</h2>
          <p style={{ color: "var(--muted)", fontSize: 13, margin: "0 0 4px" }}>
            Select a date range and click &quot;Scan IANS API&quot; to find articles that are missing from your database.
          </p>
          <p style={{ color: "#94938d", fontSize: 11, margin: "4px 0 0" }}>
            The API has 7+ days of history. All articles will be fetched irrespective of category.
          </p>
        </div>
      )}
    </div>
  );
}

function ArticleRow({
  article,
  checked,
  onToggle,
}: {
  article: RecoverableArticle;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "32px 60px 1fr auto",
        gap: 14,
        alignItems: "center",
        padding: "12px 0",
        borderTop: "1px solid #f0eee9",
        cursor: "pointer",
      }}
      onClick={onToggle}
    >
      <div className="checkbox-cell">
        <input type="checkbox" checked={checked} onChange={onToggle} style={{ width: 16, height: 16, accentColor: "var(--plum)" }} />
      </div>
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
        <strong style={{ fontSize: 13, lineHeight: 1.3 }}>{article.title}</strong>
        <span style={{ fontSize: 11, color: "#8d8b84" }}>{article.sourceName}</span>
        <span style={{ fontSize: 11, color: "#94938d" }}>{formatDate(article.createdAt)}</span>
      </div>
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", justifyContent: "flex-end" }}>
        {article.tags.slice(0, 3).map((tag) => (
          <span
            key={tag}
            style={{
              fontSize: 10,
              padding: "3px 8px",
              background: "#f3f2ee",
              borderRadius: 12,
              color: "#7a766e",
            }}
          >
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}
