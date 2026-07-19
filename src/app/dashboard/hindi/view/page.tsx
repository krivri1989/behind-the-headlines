"use client";

import { ArrowLeft, Calendar, Loader2, AlertCircle, User } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

type ArticleDetail = {
  title: string;
  content: string;
  shortDesc: string;
  imageUrl: string;
  imageCaption: string;
  byline: string;
  createdAt: string;
  tags: Array<{ slug: string; name: string }>;
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("hi-IN", { day: "numeric", month: "long", year: "numeric" });
}

export default function HindiViewPage() {
  const [article, setArticle] = useState<ArticleDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const slug = params.get("slug");
    if (!slug) {
      setError("No article slug provided");
      setLoading(false);
      return;
    }

    // Read token from localStorage (saved by the browse page)
    const token = localStorage.getItem("ians_hindi_token");
    if (!token) {
      setError("IANS token not found. Please go back to the Hindi browse page and enter the token.");
      setLoading(false);
      return;
    }

    fetch(`/api/hindi?mode=detail&slug=${encodeURIComponent(slug)}&token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `HTTP ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        setArticle(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load article");
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#f7f6f2" }}>
        <div style={{ textAlign: "center" }}>
          <Loader2 size={32} className="spinning" style={{ color: "var(--plum)", margin: "0 auto 12px" }} />
          <p style={{ color: "var(--muted)", fontSize: 14 }}>Loading Hindi article...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#f7f6f2" }}>
        <div style={{ textAlign: "center", maxWidth: 400 }}>
          <AlertCircle size={32} style={{ color: "#c15048", margin: "0 auto 12px" }} />
          <p style={{ color: "#c15048", fontSize: 14, fontWeight: 600, marginBottom: 16 }}>{error}</p>
          <Link href="/dashboard/hindi" style={{ color: "var(--plum)", fontSize: 13, fontWeight: 700 }}>
            ← Back to Hindi News
          </Link>
        </div>
      </div>
    );
  }

  if (!article) return null;

  const imageUrl = article.imageUrl
    ? article.imageUrl.replace("https://iansportalimages.s3.amazonaws.com", "https://d2lnbwhcsmj8tp.cloudfront.net")
    : "";

  return (
    <div style={{ minHeight: "100vh", background: "#f7f6f2" }} lang="hi">
      {/* Top bar */}
      <div style={{
        background: "#fff",
        borderBottom: "1px solid #e9e7e1",
        padding: "12px 24px",
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}>
        <Link href="/dashboard/hindi" style={{
          display: "flex", alignItems: "center", gap: 6,
          color: "var(--plum)", fontSize: 13, fontWeight: 700, textDecoration: "none",
        }}>
          <ArrowLeft size={16} />
          Back to Hindi News
        </Link>
        <span style={{ marginLeft: "auto", fontSize: 11, color: "#94938d" }}>
          View-only — not saved to database
        </span>
      </div>

      {/* Article — same structure as article-reader */}
      <div style={{ maxWidth: 820, margin: "0 auto", padding: "40px 24px 60px" }}>
        <article>
          {/* Header */}
          <header style={{ marginBottom: 20 }}>
            {article.tags.length > 0 && (
              <span style={{
                fontSize: 12, fontWeight: 700, color: "#bd8b32",
                textTransform: "uppercase", letterSpacing: "0.5px",
              }}>
                {article.tags[0].name}
              </span>
            )}
            <h1 style={{
              fontSize: 32, fontWeight: 800, lineHeight: 1.2,
              margin: "8px 0 12px", color: "#202124",
              fontFamily: "'Noto Sans Devanagari', sans-serif",
            }}>
              {article.title}
            </h1>
            <div style={{
              display: "flex", gap: 16, flexWrap: "wrap",
              fontSize: 13, color: "#74756f",
              padding: "10px 0",
              borderTop: "1px solid #e9e7e1",
              borderBottom: "1px solid #e9e7e1",
            }}>
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <User size={14} /> By <strong>{article.byline}</strong>
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Calendar size={14} /> {formatDate(article.createdAt)}
              </span>
            </div>
          </header>

          {/* Featured image */}
          {imageUrl && (
            <figure style={{ margin: "20px 0" }}>
              <img
                src={imageUrl}
                alt={article.title}
                style={{ width: "100%", borderRadius: 8, display: "block" }}
              />
              {article.imageCaption && (
                <figcaption style={{
                  fontSize: 13, color: "#94938d", textAlign: "center", marginTop: 6,
                }}>
                  {article.imageCaption}
                </figcaption>
              )}
            </figure>
          )}

          {/* Content */}
          <div
            lang="hi"
            style={{
              fontFamily: "'Noto Sans Devanagari', sans-serif",
              fontSize: 17,
              lineHeight: 1.75,
              color: "#333",
            }}
            dangerouslySetInnerHTML={{ __html: article.content }}
          />

          {/* Tags */}
          {article.tags.length > 0 && (
            <div style={{
              display: "flex", gap: 8, flexWrap: "wrap", marginTop: 32,
              paddingTop: 20, borderTop: "1px solid #e9e7e1",
            }}>
              {article.tags.map((tag) => (
                <span
                  key={tag.slug}
                  style={{
                    fontSize: 12, padding: "4px 12px",
                    background: "#f3f2ee", borderRadius: 12,
                    color: "#7a766e", fontWeight: 600,
                  }}
                >
                  #{tag.name}
                </span>
              ))}
            </div>
          )}
        </article>
      </div>
    </div>
  );
}
