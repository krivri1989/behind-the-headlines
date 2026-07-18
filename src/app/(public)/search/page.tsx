import { searchArticles } from "@/lib/public-data";
import { ArticleCard } from "@/components/article-card";
import Link from "next/link";
import type { Metadata } from "next";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Search",
  description: "Search for news articles across all categories.",
  robots: { index: false, follow: true },
};

type Props = { searchParams: Promise<{ q?: string; page?: string }> };

export default async function SearchPage({ searchParams }: Props) {
  const { q, page: pageStr } = await searchParams;
  const query = q || "";
  const page = Number(pageStr) || 1;
  const result = await searchArticles(query, page, 20);

  return (
    <div className="search-page">
      <nav className="breadcrumb">
        <Link href="/">Home</Link>
        <span className="breadcrumb-sep">/</span>
        <span className="breadcrumb-current">Search</span>
      </nav>

      <header className="search-header">
        <h1 className="page-title">Search</h1>
        <form action="/search" method="GET" className="search-form">
          <input type="text" name="q" defaultValue={query} placeholder="Search articles..." autoFocus />
          <button type="submit">Search</button>
        </form>
      </header>

      {query && (
        <p className="search-results-info">
          {result.total > 0
            ? result.total + " result" + (result.total === 1 ? "" : "s") + " for \"" + query + "\""
            : "No results found for \"" + query + "\""}
        </p>
      )}

      {result.articles.length > 0 && (
        <>
          <div className="search-grid">
            {result.articles.map((article) => (
              <ArticleCard key={article.id} article={article} variant="default" />
            ))}
          </div>

          {result.totalPages > 1 && (
            <div className="pagination">
              {page > 1 && (
                <Link href={"/search?q=" + encodeURIComponent(query) + "&page=" + (page - 1)} className="page-link">&lsaquo; Previous</Link>
              )}
              {Array.from({ length: result.totalPages }, (_, i) => i + 1)
                .filter((p) => Math.abs(p - page) <= 2 || p === 1 || p === result.totalPages)
                .map((p, i, arr) => (
                  <span key={p} className="pagination-group">
                    {i > 0 && arr[i - 1] !== p - 1 && <span className="page-ellipsis">…</span>}
                    <Link
                      href={"/search?q=" + encodeURIComponent(query) + "&page=" + p}
                      className={"page-link" + (p === page ? " active" : "")}
                    >
                      {p}
                    </Link>
                  </span>
                ))}
              {page < result.totalPages && (
                <Link href={"/search?q=" + encodeURIComponent(query) + "&page=" + (page + 1)} className="page-link">Next &rsaquo;</Link>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
