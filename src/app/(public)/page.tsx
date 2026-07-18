import { getLeadStory, getSecondaryStories, getLatestNews, getVisibleCategories, getCategorySection, getTrendingArticles, getSiteSettingsPublic, getLatestByCategory, getSpecialArticles } from "@/lib/public-data";
import { ArticleCard } from "@/components/article-card";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const revalidate = 300; // Revalidate every 5 minutes

export default async function HomePage() {
  const [lead, secondary, latestNews, categories, trending, settings, latestByCategory, jjdSpecial] = await Promise.all([
    getLeadStory(),
    getSecondaryStories(5, undefined),
    getLatestNews(15),
    getVisibleCategories(),
    getTrendingArticles(10),
    getSiteSettingsPublic(),
    getLatestByCategory(8),
    getSpecialArticles("jjd-special", 6),
  ]);

  const publicationName = (settings?.publicationName as string) || "Behind The Headlines";

  // Get category sections for the first 4 visible categories
  const topCategorySlugs = categories.slice(0, 4).map((c) => c.slug);
  const categorySections = await Promise.all(
    topCategorySlugs.map((slug) => getCategorySection(slug, 5))
  );

  return (
    <div className="homepage">
      {/* Breaking news ticker */}
      {latestNews.length > 0 && (
        <div className="breaking-bar">
          <div className="breaking-inner">
            <span className="breaking-label">BREAKING</span>
            <div className="breaking-ticker">
              {latestNews.slice(0, 8).map((article, i) => (
                <Link key={"a" + i} href={"/article/" + article.slug} className="breaking-item">
                  {article.title}
                </Link>
              ))}
              {latestNews.slice(0, 8).map((article, i) => (
                <Link key={"b" + i} href={"/article/" + article.slug} className="breaking-item">
                  {article.title}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* First 3-column section: Latest by Category | Trending | JJD Special */}
      <section className="home-section top-tri-column">
        <div className="tri-column-grid">
          {/* Column 1: Latest by category */}
          <div className="tri-col">
            {/* <div className="section-header">
              <h2 className="section-title">Latest by Category</h2>
            </div> */}
            <div className="tri-col-list">
              {latestByCategory.map((item, i) => (
                <div key={item.category.slug} className="tri-col-item">
                  {i === 0 ? (
                    <>
                      <Link href={"/category/" + item.category.slug} className="tri-col-cat">{item.category.name}</Link>
                      <ArticleCard article={item.article} variant="default" />
                    </>
                  ) : (
                    <div className="tri-col-text-row">
                      <Link href={"/category/" + item.category.slug} className="tri-col-cat-sm">{item.category.name}</Link>
                      <Link href={"/article/" + item.article.slug} className="tri-col-link">{item.article.title}</Link>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Column 2: Trending */}
          <div className="tri-col tri-col-trending">
            {/* <div className="section-header">
              <h2 className="section-title">Trending</h2>
            </div> */}
            <div className="trending-column">
              {trending[0] && (
                <div className="trending-col-featured">
                  <ArticleCard article={trending[0]} variant="default" />
                </div>
              )}
              {(trending[1] || trending[2]) && (
                <div className="trending-col-row">
                  {trending[1] && (
                    <div className="trending-col-half">
                      <ArticleCard article={trending[1]} variant="default" />
                    </div>
                  )}
                  {trending[2] && (
                    <div className="trending-col-half">
                      <ArticleCard article={trending[2]} variant="default" />
                    </div>
                  )}
                </div>
              )}
              <div className="trending-col-list">
                {trending.slice(3, 6).map((article) => (
                  <div key={article.id} className="trending-col-item">
                    <ArticleCard article={article} variant="compact" />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Column 3: JJD Special */}
          <div className="tri-col"> <br />
            {/* <div className="section-header">
              <h2 className="section-title">{jjdSpecial.label}</h2>
              {jjdSpecial.articles[0] && <Link href={"/category/jjd-special"} className="section-more">More &rsaquo;</Link>}
            </div> */}
            <div className="tri-col-list">
              {jjdSpecial.articles.map((article, i) => (
                <div key={article.id} className="tri-col-item">
                  {i === 0 ? (
                    <ArticleCard article={article} variant="default" />
                  ) : (
                    <div className="tri-col-text-row">
                      {article.categories[0] && <Link href={"/category/" + article.categories[0].slug} className="tri-col-cat-sm">{article.categories[0].name}</Link>}
                      <Link href={"/article/" + article.slug} className="tri-col-link">{article.title}</Link>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Hero section: lead story + secondary grid */}
      {lead && (
        <section className="hero-section">
          <div className="hero-grid">
            <ArticleCard article={lead} variant="lead" />
            <div className="hero-secondary">
              {secondary.slice(0, 4).map((article) => (
                <ArticleCard key={article.id} article={article} variant="compact" />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Main content + sidebar */}
      <div className="home-content-layout">
        <div className="home-main-col">
          {/* Latest news section */}
          <section className="home-section">
            <div className="section-header">
              <h2 className="section-title">Latest News</h2>
              <Link href="/search?q=" className="section-more">View all</Link>
            </div>
            <div className="latest-grid">
              {latestNews.slice(0, 6).map((article) => (
                <ArticleCard key={article.id} article={article} variant="default" />
              ))}
            </div>
          </section>

          {/* Category sections */}
          {categorySections.map((section, i) => {
            if (!section.category || section.articles.length === 0) return null;
            return (
              <section className="home-section" key={i}>
                <div className="section-header">
                  <h2 className="section-title">{section.category.name}</h2>
                  <Link href={"/category/" + section.category.slug} className="section-more">More {section.category.name} &rsaquo;</Link>
                </div>
                <div className="category-section-grid">
                  {section.articles[0] && (
                    <ArticleCard article={section.articles[0]} variant="default" />
                  )}
                  <div className="category-section-list">
                    {section.articles.slice(1, 5).map((article) => (
                      <ArticleCard key={article.id} article={article} variant="compact" />
                    ))}
                  </div>
                </div>
              </section>
            );
          })}
        </div>

        {/* Sidebar */}
        <aside className="home-sidebar">
          {/* Trending */}
          <section className="sidebar-section">
            <h2 className="sidebar-title">Trending</h2>
            <ol className="trending-list">
              {trending.slice(0, 7).map((article, i) => (
                <li key={article.id} className="trending-item">
                  <span className="trending-number">{i + 1}</span>
                  <Link href={"/article/" + article.slug}>
                    <h3>{article.title}</h3>
                    <span className="trending-meta">{article.categories[0]?.name}</span>
                  </Link>
                </li>
              ))}
            </ol>
          </section>

          {/* Most recent in sidebar */}
          <section className="sidebar-section">
            <h2 className="sidebar-title">Latest Updates</h2>
            <div className="sidebar-latest">
              {latestNews.slice(0, 8).map((article) => (
                <ArticleCard key={article.id} article={article} variant="text" />
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
