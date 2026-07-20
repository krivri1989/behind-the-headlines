import { getLatestNews, getVisibleCategories, getCategorySection, getTrendingArticles, getSiteSettingsPublic, getLatestByCategory, getSpecialArticles, getPublicMenu, getSponsoredForCategory, getArticlesByIds, type PublicSponsored } from "@/lib/public-data";
import { ArticleCard } from "@/components/article-card";
import { AdSlot } from "@/components/ad-slot";
import { SponsoredCard } from "@/components/sponsored-card";
import { CustomEmbedsForPosition } from "@/components/custom-embeds";
import Link from "next/link";
import type { PublicArticle } from "@/lib/public-data";

export const dynamic = "force-dynamic";
export const revalidate = 300; // Revalidate every 5 minutes

function TriColHorizontalArticle({ article, category }: { article: PublicArticle; category?: { name: string; slug: string } }) {
  const href = "/article/" + article.slug;
  const img = article.featuredImage;
  return (
    <Link href={href} className="tri-col-article-horizontal">
      {img?.url ? (
        <div className="tri-col-article-thumb">
          <img src={img.url} alt={img.alt || article.title} />
        </div>
      ) : null}
      <div className="tri-col-article-body">
        {category && <span className="tri-col-article-cat">{category.name}</span>}
        <h4 className="tri-col-article-title">{article.title}</h4>
      </div>
    </Link>
  );
}

export default async function HomePage() {
  const [latestNews, categories, trending, settings, latestByCategory, jjdSpecial, headerMenu] = await Promise.all([
    getLatestNews(15),
    getVisibleCategories(),
    getTrendingArticles(20),
    getSiteSettingsPublic(),
    getLatestByCategory(8),
    getSpecialArticles("jjd-special", 10),
    getPublicMenu("header"),
  ]);

  const publicationName = (settings?.publicationName as string) || "Behind The Headlines";

  // Deduplicate articles across the tri-column section so no article
  // appears in more than one column. Priority: Col1 (latestByCategory) >
  // Col3 (jjdSpecial) > Col2 (trending).
  const usedIds = new Set<string>();
  for (const item of latestByCategory) usedIds.add(item.article.id);
  const dedupedJjdArticles = jjdSpecial.articles.filter((a) => !usedIds.has(a.id));
  for (const a of dedupedJjdArticles) usedIds.add(a.id);
  const dedupedTrending = trending.filter((a) => !usedIds.has(a.id));
  for (const a of dedupedTrending) usedIds.add(a.id);
  const jjdSpecialDeduped = { label: jjdSpecial.label, articles: dedupedJjdArticles };

  // For the category sections below the tri-column, only dedup against
  // Column 1 (Latest by Category). The Trending and JJD Special columns are
  // feature columns and should not deplete the category sections below,
  // otherwise sections like "Trending" end up with only 1 article.
  const categorySectionUsedIds = new Set<string>();
  for (const item of latestByCategory) categorySectionUsedIds.add(item.article.id);

  // Derive category sections from the header menu items that point to a category.
  // Menu items have href like "/category/national", "/category/sports", etc.
  const menuCategorySlugs = headerMenu
    .map((item) => {
      const match = item.href.match(/^\/category\/([^/]+)$/);
      return match ? match[1] : null;
    })
    .filter((slug): slug is string => Boolean(slug));

  // Fallback to first 4 visible categories if the menu has no category links
  const sectionSlugs = menuCategorySlugs.length > 0
    ? menuCategorySlugs
    : categories.slice(0, 4).map((c) => c.slug);

  const categorySections = await Promise.all(
    sectionSlugs.map((slug) => getCategorySection(slug, 18))
  );

  // Filter out articles already shown in the tri-column section
  const dedupedCategorySections = categorySections.map((section) => ({
    ...section,
    articles: section.articles.filter((a) => !categorySectionUsedIds.has(a.id)).slice(0, 6),
  }));

  // Fetch sponsored content for each category section (for pin-to-top)
  const sponsoredByCategory = await Promise.all(
    dedupedCategorySections.map((section) =>
      section.category ? getSponsoredForCategory(section.category.slug) : Promise.resolve([])
    )
  );

  // Fetch the full article data for any sponsored article_pin items
  const pinnedArticleIds = sponsoredByCategory
    .flat()
    .filter((s) => s.type === "article_pin" && s.articleId)
    .map((s) => s.articleId as string);
  const pinnedArticles = await getArticlesByIds(pinnedArticleIds);
  const pinnedArticlesById = new Map(pinnedArticles.map((a) => [a.id, a]));

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
                      <ArticleCard article={item.article} variant="image-title" />
                    </>
                  ) : (
                    <TriColHorizontalArticle article={item.article} category={item.category} />
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
              {dedupedTrending[0] && (
                <div className="trending-col-featured">
                  <ArticleCard article={dedupedTrending[0]} variant="default" />
                </div>
              )}
              {(dedupedTrending[1] || dedupedTrending[2]) && (
                <div className="trending-col-row">
                  {dedupedTrending[1] && (
                    <div className="trending-col-half">
                      <ArticleCard article={dedupedTrending[1]} variant="default" />
                    </div>
                  )}
                  {dedupedTrending[2] && (
                    <div className="trending-col-half">
                      <ArticleCard article={dedupedTrending[2]} variant="default" />
                    </div>
                  )}
                </div>
              )}
              <div className="trending-col-list">
                {dedupedTrending.slice(3, 6).map((article) => (
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
              <h2 className="section-title">{jjdSpecialDeduped.label}</h2>
              {jjdSpecialDeduped.articles[0] && <Link href={"/category/jjd-special"} className="section-more">More &rsaquo;</Link>}
            </div> */}
            {/* 300x250 ad at top of 3rd column */}
            <AdSlot slot="homepage_tri_col_top" page="homepage" />
            <div className="tri-col-list">
              {jjdSpecialDeduped.articles.map((article) => (
                <div key={article.id} className="tri-col-item">
                  <TriColHorizontalArticle article={article} category={article.categories[0]} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Custom embeds — below 3rd column (e.g., Sensex/Nifty ticker tape) */}
      <CustomEmbedsForPosition embeds={((settings?.customEmbeds as Array<Record<string, unknown>>) || []).map((e) => ({ name: String(e.name || ""), position: String(e.position || ""), html: String(e.html || ""), active: Boolean(e.active) }))} position="homepage_below_tri_col" />

      {/* Main content + sidebar */}
      <div className="home-content-layout">
        <div className="home-main-col">
          {/* Category sections */}
          {dedupedCategorySections.map((section, i) => {
            if (!section.category || section.articles.length === 0) return null;
            const sponsored = sponsoredByCategory[i] || [];
            return (
              <section className="home-section" key={i}>
                {/* 728x90 ad above each category section */}
                <AdSlot slot="homepage_category_top" page="homepage" categorySlug={section.category.slug} />
                <div className="section-header">
                  <h2 className="section-title">{section.category.name}</h2>
                  <Link href={"/category/" + section.category.slug} className="section-more">More {section.category.name} &rsaquo;</Link>
                </div>
                <div className="category-section-grid">
                  {section.articles[0] && (
                    <ArticleCard article={section.articles[0]} variant="default" />
                  )}
                  <div className="category-section-list">
                    {/* Sponsored pin-to-top items first */}
                    {sponsored.map((item) => (
                      <SponsoredCard
                        key={item.id}
                        item={item}
                        article={item.articleId ? (pinnedArticlesById.get(item.articleId) ?? null) : null}
                      />
                    ))}
                    {section.articles.slice(1, 6).map((article) => (
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
          {/* 300x250/600 ad at top of sidebar */}
          <AdSlot slot="homepage_sidebar_top" page="homepage" />

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
