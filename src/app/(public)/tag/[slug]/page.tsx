import { getTagArticles } from "@/lib/public-data";
import { ArticleCard } from "@/components/article-card";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const revalidate = 300;

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ page?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const result = await getTagArticles(slug, 1, 1);
  if (!result.tag) return { title: "Tag Not Found" };
  return {
    title: "#" + result.tag.name,
    description: "Articles tagged with " + result.tag.name,
    robots: { index: true, follow: true },
  };
}

export default async function TagPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { page: pageStr } = await searchParams;
  const page = Number(pageStr) || 1;
  const result = await getTagArticles(slug, page, 20);
  if (!result.tag) notFound();

  const { tag, articles, total, totalPages } = result;

  return (
    <div className="tag-page">
      <nav className="breadcrumb">
        <Link href="/">Home</Link>
        <span className="breadcrumb-sep">/</span>
        <span className="breadcrumb-current">#{tag.name}</span>
      </nav>

      <header className="tag-header">
        <h1 className="page-title">#{tag.name}</h1>
        <span className="category-count">{total} article{total === 1 ? "" : "s"}</span>
      </header>

      {articles.length === 0 ? (
        <div className="empty-state">No articles with this tag yet.</div>
      ) : (
        <>
          <div className="search-grid">
            {articles.map((article) => (
              <ArticleCard key={article.id} article={article} variant="default" />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="pagination">
              {page > 1 && (
                <Link href={"/tag/" + slug + "?page=" + (page - 1)} className="page-link">&lsaquo; Previous</Link>
              )}
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => Math.abs(p - page) <= 2 || p === 1 || p === totalPages)
                .map((p, i, arr) => (
                  <span key={p} className="pagination-group">
                    {i > 0 && arr[i - 1] !== p - 1 && <span className="page-ellipsis">…</span>}
                    <Link href={"/tag/" + slug + "?page=" + p} className={"page-link" + (p === page ? " active" : "")}>{p}</Link>
                  </span>
                ))}
              {page < totalPages && (
                <Link href={"/tag/" + slug + "?page=" + (page + 1)} className="page-link">Next &rsaquo;</Link>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
