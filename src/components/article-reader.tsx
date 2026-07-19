"use client";

import { useState } from "react";
import Link from "next/link";
import { stripLeadingImages, stripAgencyArtifacts } from "@/lib/content-helpers";
import { ArticleComments } from "./article-comments";
import { useSiteSettings } from "@/components/site-settings-provider";
import type { PublicArticle } from "@/lib/public-data";

function cleanContent(html: string): string {
  return stripAgencyArtifacts(stripLeadingImages(html));
}

function FeaturedImage({ image, title, fallback }: { image: PublicArticle["featuredImage"]; title: string; fallback?: string }) {
  const [srcsetFailed, setSrcsetFailed] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);
  if (!image) return <div className="article-fallback-image" />;

  // Primary image (or variants) failed — fall back to the default image if available.
  if (srcsetFailed || imgFailed) {
    if (fallback && fallback !== image.url && !imgFailed) {
      return <img src={fallback} alt={image.alt || title} onError={() => setImgFailed(true)} />;
    }
    return <div className="article-fallback-image" />;
  }

  const webp = image.variants.filter((v) => v.format === "webp");
  const avif = image.variants.filter((v) => v.format === "avif");
  const srcsetWebp = webp.map((v) => v.url + " " + v.width + "w").join(", ");
  const srcsetAvif = avif.map((v) => v.url + " " + v.width + "w").join(", ");
  return (
    <picture>
      {srcsetAvif && <source type="image/avif" srcSet={srcsetAvif} sizes="(max-width: 768px) 100vw, 820px" />}
      {srcsetWebp && <source type="image/webp" srcSet={srcsetWebp} sizes="(max-width: 768px) 100vw, 820px" />}
      <img src={image.url} alt={image.alt || title} width={image.width || 820} height={image.height || 460} onError={() => setSrcsetFailed(true)} />
    </picture>
  );
}

function ArticleBody({ article }: { article: PublicArticle }) {
  const { defaultImageUrl } = useSiteSettings();
  const primary = article.categories[0];
  const date = new Date(article.publishedAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
  const imageToUse: PublicArticle["featuredImage"] = article.featuredImage || (defaultImageUrl
    ? {
        url: defaultImageUrl,
        alt: article.title,
        caption: "",
        credit: "",
        width: 0,
        height: 0,
        variants: [],
      }
    : null);
  return (
    <article className="reader-article" data-article-id={article.id}>
      <header className="article-header">
        {primary && <Link href={"/category/" + primary.slug} className="article-header-cat">{primary.name}</Link>}
        <h1 className="article-header-title">{article.title}</h1>
        <div className="article-header-meta">
          <span className="article-author">By <strong>{article.author.name}</strong></span>
          {article.sourceName && <span className="article-source">Source: {article.sourceName}</span>}
          <span className="article-date">{date}</span>
        </div>
      </header>

      {imageToUse && (
        <figure className="article-featured-image">
          <FeaturedImage image={imageToUse} title={article.title} fallback={defaultImageUrl} />
          {(imageToUse.caption || imageToUse.credit) && (
            <figcaption className="article-image-caption">
              {imageToUse.caption && <span>{imageToUse.caption}</span>}
              {imageToUse.credit && <span className="article-image-credit">{imageToUse.credit}</span>}
            </figcaption>
          )}
        </figure>
      )}

      <div className="article-content" dangerouslySetInnerHTML={{ __html: cleanContent(article.content) }} />

      {article.tags.length > 0 && (
        <div className="article-tags">
          {article.tags.map((tag) => (
            <Link key={tag.id} href={"/tag/" + tag.slug} className="article-tag">#{tag.name}</Link>
          ))}
        </div>
      )}
    </article>
  );
}

function ArticleNav({ prev, next }: { prev: PublicArticle | null; next: PublicArticle | null }) {
  if (!prev && !next) return null;
  return (
    <nav className="article-prev-next" aria-label="Article navigation">
      {prev ? (
        <Link href={"/article/" + prev.slug} className="article-nav-link article-nav-prev">
          {prev.featuredImage?.url && (
            <div className="article-nav-thumb">
              <img src={prev.featuredImage.url} alt={prev.featuredImage.alt || prev.title} />
            </div>
          )}
          <div className="article-nav-text">
            <span className="article-nav-direction">&larr; Previous</span>
            <span className="article-nav-title">{prev.title}</span>
          </div>
        </Link>
      ) : <span className="article-nav-link article-nav-prev disabled" />}
      {next ? (
        <Link href={"/article/" + next.slug} className="article-nav-link article-nav-next">
          <div className="article-nav-text">
            <span className="article-nav-direction">Next &rarr;</span>
            <span className="article-nav-title">{next.title}</span>
          </div>
          {next.featuredImage?.url && (
            <div className="article-nav-thumb">
              <img src={next.featuredImage.url} alt={next.featuredImage.alt || next.title} />
            </div>
          )}
        </Link>
      ) : <span className="article-nav-link article-nav-next disabled" />}
    </nav>
  );
}

export function ArticleReader({
  initialArticle,
  related,
  prevArticle,
  nextArticle,
  commentsEnabled,
}: {
  initialArticle: PublicArticle;
  related: PublicArticle[];
  prevArticle: PublicArticle | null;
  nextArticle: PublicArticle | null;
  commentsEnabled?: boolean;
}) {
  return (
    <div className="article-reader">
      <div className="article-main-col">
        <ArticleBody article={initialArticle} />
        <ArticleNav prev={prevArticle} next={nextArticle} />
        <ArticleComments articleId={initialArticle.id} enabled={Boolean(commentsEnabled)} />
      </div>

      <aside className="article-sidebar">
        <div className="article-sidebar-inner">
          <h2 className="sidebar-title">Related Stories</h2>
          <div className="article-related-list">
            {related.map((rel) => (
              <Link key={rel.id} href={"/article/" + rel.slug} className="article-related-item">
                {rel.featuredImage?.url && (
                  <div className="article-related-thumb">
                    <img src={rel.featuredImage.url} alt={rel.featuredImage.alt || rel.title} />
                  </div>
                )}
                <div className="article-related-body">
                  <span className="article-related-cat">{rel.categories[0]?.name}</span>
                  <h4>{rel.title}</h4>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}
