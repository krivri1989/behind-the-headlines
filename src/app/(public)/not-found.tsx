import Link from "next/link";
import { Search, Home, Newspaper } from "lucide-react";
import { getSiteSettingsPublic, getVisibleCategories } from "@/lib/public-data";

export const dynamic = "force-dynamic";

export default async function NotFound() {
  const [settings, categories] = await Promise.all([
    getSiteSettingsPublic(),
    getVisibleCategories(),
  ]);

  const name = (settings?.publicationName as string) || "Behind The Headlines";

  return (
    <div className="not-found-page">
      <div className="not-found-content">
        <div className="not-found-illustration">
          <span className="not-found-code">404</span>
          <div className="not-found-paper">
            <Newspaper size={48} />
          </div>
        </div>

        <h1 className="not-found-title">Page not found</h1>
        <p className="not-found-lead">
          The page you are looking for may have been moved, deleted, or never existed.
          Try searching or explore the latest stories from <strong>{name}</strong>.
        </p>

        <form action="/search" method="get" className="not-found-search">
          <input
            type="text"
            name="q"
            placeholder="Search for articles, topics, or keywords…"
            autoFocus
            aria-label="Search"
          />
          <button type="submit" className="not-found-search-button">
            <Search size={18} /> Search
          </button>
        </form>

        <div className="not-found-actions">
          <Link href="/" className="not-found-primary">
            <Home size={18} /> Back to homepage
          </Link>
          {/* <Link href="/search?q=" className="not-found-secondary">
            Latest news
          </Link> */}
        </div>

        {categories.length > 0 && (
          <div className="not-found-categories">
            <p>Popular categories</p>
            <div className="not-found-category-list">
              {categories.slice(0, 8).map((cat) => (
                <Link key={cat.id} href={`/category/${cat.slug}`} className="not-found-category">
                  {cat.name}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
