"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { stripLeadingImages, stripAgencyArtifacts } from "@/lib/content-helpers";
import type { PublicArticle } from "@/lib/public-data";

export function useImageFallback() {
  const [error, setError] = useState(false);
  return { error, onError: () => setError(true) };
}

function cleanContent(html: string): string {
  return stripAgencyArtifacts(stripLeadingImages(html));
}

function FeaturedImage({ image, title }: { image: PublicArticle["featuredImage"]; title: string }) {
  const { error, onError } = useImageFallback();
  if (!image || error) return <div className="article-fallback-image" />;
  const webp = image.variants.filter((v) => v.format === "webp");
  const avif = image.variants.filter((v) => v.format === "avif");
  const srcsetWebp = webp.map((v) => v.url + " " + v.width + "w").join(", ");
  const srcsetAvif = avif.map((v) => v.url + " " + v.width + "w").join(", ");
  return (
    <picture>
      {srcsetAvif && <source type="image/avif" srcSet={srcsetAvif} sizes="(max-width: 768px) 100vw, 820px" />}
      {srcsetWebp && <source type="image/webp" srcSet={srcsetWebp} sizes="(max-width: 768px) 100vw, 820px" />}
      <img src={image.url} alt={image.alt || title} width={image.width || 820} height={image.height || 460} onError={onError} />
    </picture>
  );
}

function ArticleBody({ article }: { article: PublicArticle }) {
  const primary = article.categories[0];
  const date = new Date(article.publishedAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
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

      {article.featuredImage && (
        <figure className="article-featured-image">
          <FeaturedImage image={article.featuredImage} title={article.title} />
          {(article.featuredImage.caption || article.featuredImage.credit) && (
            <figcaption className="article-image-caption">
              {article.featuredImage.caption && <span>{article.featuredImage.caption}</span>}
              {article.featuredImage.credit && <span className="article-image-credit">{article.featuredImage.credit}</span>}
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

export function ArticleReader({
  initialArticle,
  related,
  nextArticle,
}: {
  initialArticle: PublicArticle;
  related: PublicArticle[];
  nextArticle: PublicArticle | null;
}) {
  const [articles, setArticles] = useState<PublicArticle[]>([initialArticle]);
  const [nextId, setNextId] = useState<string | null>(nextArticle ? nextArticle.id : null);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(!!nextArticle);
  const endRef = useRef<HTMLDivElement | null>(null);

  const loadNext = useCallback(async () => {
    if (loading || !hasMore || !nextId) return;
    setLoading(true);
    try {
      const last = articles[articles.length - 1];
      const res = await fetch(`/api/articles/next?id=${last.id}&categories=${last.categories.map((c) => c.id).join(",")}`);
      const data = await res.json();
      if (res.ok && data.article) {
        setArticles((prev) => [...prev, data.article]);
        setNextId(data.article.id);
      } else {
        setHasMore(false);
      }
    } catch {
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [articles, hasMore, loading, nextId]);

  useEffect(() => {
    if (!endRef.current || !hasMore) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) loadNext();
      },
      { rootMargin: "300px" }
    );
    observer.observe(endRef.current);
    return () => observer.disconnect();
  }, [loadNext, hasMore, articles.length]);

  return (
    <div className="article-reader">
      <div className="article-main-col">
        {articles.map((article) => (
          <ArticleBody key={article.id} article={article} />
        ))}
        {hasMore && <div ref={endRef} className="article-loader">Loading next story...</div>}
        {!hasMore && <div className="article-end">No more stories in this category</div>}
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
