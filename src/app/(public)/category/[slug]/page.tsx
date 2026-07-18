import { getCategoryArticles, getSiteSettingsPublic } from "@/lib/public-data";
import { ArticleCard } from "@/components/article-card";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

export const revalidate = 300;

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ page?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const settings = await getSiteSettingsPublic();
  const result = await getCategoryArticles(slug, 1, 1);
  if (!result.category) return { title: "Category Not Found" };
  const name = (settings?.publicationName as string) || "Behind The Headlines";
  return {
    title: result.category.name + " News",
    description: result.category.description || "Latest " + result.category.name + " news, updates, and stories from " + name,
    alternates: { canonical: "/category/" + slug },
  };
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { page: pageStr } = await searchParams;
  const page = Number(pageStr) || 1;
  const result = await getCategoryArticles(slug, page, 20);
  if (!result.category) notFound();

  const { category, articles, total, totalPages } = result;

  return (
    <div className="category-page">
      <nav className="breadcrumb">
        <Link href="/">Home</Link>
        <span className="breadcrumb-sep">/</span>
        <span className="breadcrumb-current">{category.name}</span>
      </nav>

      <header className="category-header">
        <h1 className="category-title">{category.name}</h1>
        {category.description && <p className="category-description">{category.description}</p>}
        <span className="category-count">{total} article{total === 1 ? "" : "s"}</span>
      </header>

      {articles.length === 0 ? (
        <div className="empty-state">No articles in this category yet.</div>
      ) : (
        <>
          {/* First article as lead */}
          {articles[0] && page === 1 && (
            <div className="category-lead">
              <ArticleCard article={articles[0]} variant="horizontal" />
            </div>
          )}

          {/* Grid of remaining articles */}
          <div className="category-grid">
            {articles.slice(page === 1 ? 1 : 0).map((article) => (
              <ArticleCard key={article.id} article={article} variant="default" />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="pagination">
              {page > 1 && (
                <Link href={"/category/" + slug + "?page=" + (page - 1)} className="page-link">&lsaquo; Previous</Link>
              )}
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => Math.abs(p - page) <= 2 || p === 1 || p === totalPages)
                .map((p, i, arr) => (
                  <span key={p} className="pagination-group">
                    {i > 0 && arr[i - 1] !== p - 1 && <span className="page-ellipsis">…</span>}
                    <Link
                      href={"/category/" + slug + "?page=" + p}
                      className={"page-link" + (p === page ? " active" : "")}
                    >
                      {p}
                    </Link>
                  </span>
                ))}
              {page < totalPages && (
                <Link href={"/category/" + slug + "?page=" + (page + 1)} className="page-link">Next &rsaquo;</Link>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
