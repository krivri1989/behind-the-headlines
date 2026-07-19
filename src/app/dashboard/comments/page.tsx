"use client";

import { useEffect, useState } from "react";
import { Check, X, Trash2, Loader2, MessageSquare } from "lucide-react";
import { apiFetch } from "@/lib/api-client";

type ModerationComment = {
  id: string;
  articleId: string;
  articleTitle: string;
  authorName: string;
  authorEmail: string;
  content: string;
  status: string;
  createdAt: string;
};

type FilterStatus = "pending" | "approved" | "rejected" | "all";

export default function CommentsPage() {
  const [comments, setComments] = useState<ModerationComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterStatus>("pending");
  const [acting, setActing] = useState<string | null>(null);

  async function loadComments(status: FilterStatus) {
    setLoading(true);
    try {
      const data = await apiFetch<{ comments: ModerationComment[] }>(`/api/comments/moderate?status=${status}`);
      setComments(data.comments || []);
    } catch {
      setComments([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadComments(filter); }, [filter]);

  async function moderate(id: string, action: "approve" | "reject" | "delete") {
    setActing(id);
    try {
      await apiFetch("/api/comments/moderate", { method: "PUT", body: JSON.stringify({ id, action }) });
      setComments((prev) => prev.filter((c) => c.id !== id));
    } catch {
      alert("Failed to update comment");
    } finally {
      setActing(null);
    }
  }

  const counts = {
    pending: comments.filter((c) => c.status === "pending").length,
    all: comments.length,
  };

  return (
    <div className="workspace-panel">
      <div className="panel-heading">
        <div>
          <h2>Comments Moderation</h2>
          <p>Review, approve, reject, or delete reader comments.</p>
        </div>
      </div>

      <div className="filter-tabs">
        {(["pending", "approved", "rejected", "all"] as FilterStatus[]).map((s) => (
          <button
            key={s}
            className={"filter-tab" + (filter === s ? " active" : "")}
            onClick={() => setFilter(s)}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
            {s === "pending" && counts.pending > 0 && <span className="filter-badge">{counts.pending}</span>}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="empty-state"><Loader2 size={24} className="spinning" /> Loading comments...</div>
      ) : comments.length === 0 ? (
        <div className="empty-state">
          <MessageSquare size={32} />
          <p>No {filter !== "all" ? filter : ""} comments to show.</p>
        </div>
      ) : (
        <div className="comments-moderation-list">
          {comments.map((c) => (
            <div key={c.id} className="comment-moderation-item">
              <div className="comment-moderation-header">
                <div className="comment-moderation-author">
                  <div className="comment-moderation-avatar">{c.authorName.charAt(0).toUpperCase()}</div>
                  <div>
                    <div className="comment-moderation-name">{c.authorName}</div>
                    <div className="comment-moderation-email">{c.authorEmail}</div>
                  </div>
                </div>
                <span className={"comment-status-badge " + c.status}>{c.status}</span>
              </div>
              <p className="comment-moderation-content">{c.content}</p>
              <div className="comment-moderation-meta">
                <span className="comment-moderation-article">On: {c.articleTitle}</span>
                <span className="comment-moderation-date">{new Date(c.createdAt).toLocaleString("en-IN")}</span>
              </div>
              <div className="comment-moderation-actions">
                {c.status !== "approved" && (
                  <button className="btn-approve" onClick={() => moderate(c.id, "approve")} disabled={acting === c.id}>
                    {acting === c.id ? <Loader2 size={14} className="spinning" /> : <Check size={14} />} Approve
                  </button>
                )}
                {c.status !== "rejected" && (
                  <button className="btn-reject" onClick={() => moderate(c.id, "reject")} disabled={acting === c.id}>
                    <X size={14} /> Reject
                  </button>
                )}
                <button className="btn-delete" onClick={() => moderate(c.id, "delete")} disabled={acting === c.id}>
                  <Trash2 size={14} /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
