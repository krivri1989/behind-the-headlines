import Link from "next/link";
import type { PublicSponsored } from "@/lib/public-data";
import type { PublicArticle } from "@/lib/public-data";

/**
 * Renders a sponsored content card.
 * Two types:
 *   - article_pin: a real published article pinned to top with "Sponsored" badge
 *   - ad_card: a sponsored card linking to an external URL
 *
 * Props:
 *   item      — the sponsored content record
 *   article   — the full article data (required for article_pin type)
 */
export function SponsoredCard({ item, article }: { item: PublicSponsored; article?: PublicArticle | null }) {
  if (item.type === "article_pin" && article) {
    return <SponsoredArticlePin item={item} article={article} />;
  }

  if (item.type === "ad_card") {
    return <SponsoredAdCard item={item} />;
  }

  return null;
}

/** Pinned real article with "Sponsored" badge. */
function SponsoredArticlePin({ item, article }: { item: PublicSponsored; article: PublicArticle }) {
  const href = "/article/" + article.slug;
  const img = article.featuredImage;

  return (
    <article className="sponsored-card sponsored-article-pin">
      <span className="sponsored-badge">{item.label}</span>
      {img?.url && (
        <Link href={href} className="sponsored-card-img-wrap">
          <img src={img.url} alt={img.alt || article.title} />
        </Link>
      )}
      <div className="sponsored-card-body">
        {article.categories[0] && (
          <Link href={"/category/" + article.categories[0].slug} className="sponsored-card-cat">
            {article.categories[0].name}
          </Link>
        )}
        <Link href={href}>
          <h3 className="sponsored-card-title">{article.title}</h3>
        </Link>
        {article.excerpt && <p className="sponsored-card-excerpt">{article.excerpt}</p>}
      </div>
    </article>
  );
}

/** Sponsored ad card linking to an external URL. */
function SponsoredAdCard({ item }: { item: PublicSponsored }) {
  const isExternal = item.clickUrl.startsWith("http");
  const linkProps = isExternal
    ? { href: item.clickUrl, target: "_blank", rel: "noopener noreferrer sponsored" }
    : { href: item.clickUrl };

  return (
    <article className="sponsored-card sponsored-ad-card">
      <span className="sponsored-badge">{item.label}</span>
      {item.imageUrl && (
        <Link {...linkProps} className="sponsored-card-img-wrap">
          <img src={item.imageUrl} alt={item.title} />
        </Link>
      )}
      <div className="sponsored-card-body">
        <Link {...linkProps}>
          <h3 className="sponsored-card-title">{item.title}</h3>
        </Link>
        {item.description && <p className="sponsored-card-excerpt">{item.description}</p>}
      </div>
    </article>
  );
}
