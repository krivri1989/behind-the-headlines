"use client";

import { useEffect, useState } from "react";
import { Loader2, MessageCircle, Send, CheckCircle2 } from "lucide-react";

type Comment = {
  id: string;
  authorName: string;
  content: string;
  createdAt: string;
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function ArticleComments({ articleId, enabled }: { articleId: string; enabled: boolean }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [content, setContent] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!enabled) { setLoading(false); return; }
    fetch(`/api/comments?articleId=${articleId}`)
      .then((res) => res.json())
      .then((data) => { setComments(data.comments || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [articleId, enabled]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !content.trim()) return;
    setSubmitting(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleId, authorName: name, authorEmail: email, content }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to post comment");
      setContent("");
      setSuccess(data.message || "Your comment has been submitted and is awaiting approval.");
      setTimeout(() => setSuccess(""), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to post comment");
    } finally {
      setSubmitting(false);
    }
  }

  if (!enabled) return null;

  return (
    <section className="article-comments">
      <h2 className="comments-title"><MessageCircle size={20} /> Comments ({comments.length})</h2>

      <form className="comment-form" onSubmit={submit}>
        <div className="comment-form-row">
          <input
            type="text"
            placeholder="Your name *"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={100}
            aria-label="Your name"
            className="comment-name-input"
          />
          <input
            type="email"
            placeholder="Your email *"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            maxLength={200}
            aria-label="Your email"
            className="comment-email-input"
          />
        </div>
        <textarea
          placeholder="Share your thoughts..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          required
          maxLength={2000}
          rows={3}
          aria-label="Comment text"
          className="comment-text-input"
        />
        {error && <p className="comment-error">{error}</p>}
        {success && <p className="comment-success"><CheckCircle2 size={15} /> {success}</p>}
        <button type="submit" className="comment-submit" disabled={submitting || !name.trim() || !email.trim() || !content.trim()}>
          {submitting ? <Loader2 size={16} className="spinning" /> : <Send size={16} />}
          {submitting ? "Posting..." : "Post Comment"}
        </button>
      </form>

      <div className="comments-list">
        {loading ? (
          <p className="comments-empty">Loading comments...</p>
        ) : comments.length === 0 ? (
          <p className="comments-empty">Be the first to comment.</p>
        ) : (
          comments.map((c) => (
            <div key={c.id} className="comment-item">
              <div className="comment-avatar">{c.authorName.charAt(0).toUpperCase()}</div>
              <div className="comment-body">
                <div className="comment-header">
                  <span className="comment-author">{c.authorName}</span>
                  <span className="comment-time" suppressHydrationWarning>{timeAgo(c.createdAt)}</span>
                </div>
                <p className="comment-text">{c.content}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
