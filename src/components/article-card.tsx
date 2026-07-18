"use client";

import Link from "next/link";
import { useState } from "react";
import type { PublicArticle } from "@/lib/public-data";

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return mins + "m ago";
  const hours = Math.floor(mins / 60);
  if (hours < 24) return hours + "h ago";
  const days = Math.floor(hours / 24);
  if (days < 7) return days + "d ago";
  return new Date(dateStr).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function CardImage({ src, alt }: { src: string; alt: string }) {
  const [error, setError] = useState(false);
  if (error || !src) return <div className="article-card-img placeholder" />;
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setError(true)}
    />
  );
}

function Picture({ image, alt, sizes }: { image: PublicArticle["featuredImage"]; alt: string; sizes: string }) {
  if (!image?.url) return <div className="article-card-img placeholder" />;

  const webpVariants = image.variants.filter((v) => v.format === "webp");
  const avifVariants = image.variants.filter((v) => v.format === "avif");
  const srcsetWebp = webpVariants.map((v) => v.url + " " + v.width + "w").join(", ");
  const srcsetAvif = avifVariants.map((v) => v.url + " " + v.width + "w").join(", ");

  return (
    <picture>
      {srcsetAvif && <source type="image/avif" srcSet={srcsetAvif} sizes={sizes} />}
      {srcsetWebp && <source type="image/webp" srcSet={srcsetWebp} sizes={sizes} />}
      <CardImage src={image.url} alt={alt} />
    </picture>
  );
}

export function ArticleCard({ article, variant = "default" }: { article: PublicArticle; variant?: "default" | "lead" | "horizontal" | "compact" | "text" }) {
  const href = "/article/" + article.slug;
  const category = article.categories[0];
  const img = article.featuredImage;

  if (variant === "text") {
    return (
      <article className="article-card text-only">
        {category && <Link href={"/category/" + category.slug} className="article-card-cat">{category.name}</Link>}
        <Link href={href}>
          <h3 className="article-card-title">{article.title}</h3>
        </Link>
        <span className="article-card-time">{timeAgo(article.publishedAt)}</span>
      </article>
    );
  }

  if (variant === "compact") {
    return (
      <article className="article-card compact">
        {img?.url && (
          <Link href={href} className="article-card-img-wrap">
            <Picture image={img} alt={img.alt || article.title} sizes="120px" />
          </Link>
        )}
        <div className="article-card-body">
          <Link href={href}>
            <h3 className="article-card-title">{article.title}</h3>
          </Link>
          <span className="article-card-time">{timeAgo(article.publishedAt)}</span>
        </div>
      </article>
    );
  }

  if (variant === "horizontal") {
    return (
      <article className="article-card horizontal">
        <Link href={href} className="article-card-img-wrap">
          <Picture image={img} alt={img?.alt || article.title} sizes="300px" />
        </Link>
        <div className="article-card-body">
          {category && <Link href={"/category/" + category.slug} className="article-card-cat">{category.name}</Link>}
          <Link href={href}>
            <h3 className="article-card-title">{article.title}</h3>
          </Link>
          {article.excerpt && <p className="article-card-excerpt">{article.excerpt}</p>}
          <span className="article-card-time">{timeAgo(article.publishedAt)}</span>
        </div>
      </article>
    );
  }

  if (variant === "lead") {
    return (
      <article className="article-card lead">
        <Link href={href} className="article-card-img-wrap">
          <Picture image={img} alt={img?.alt || article.title} sizes="(max-width: 768px) 100vw, 720px" />
        </Link>
        <div className="article-card-body">
          {category && <Link href={"/category/" + category.slug} className="article-card-cat">{category.name}</Link>}
          <Link href={href}>
            <h2 className="article-card-title lead-title">{article.title}</h2>
          </Link>
          {article.excerpt && <p className="article-card-excerpt">{article.excerpt}</p>}
          <div className="article-card-meta">
            <span>By {article.author.name}</span>
            <span className="article-card-time">{timeAgo(article.publishedAt)}</span>
          </div>
        </div>
      </article>
    );
  }

  // default
  return (
    <article className="article-card default">
      <Link href={href} className="article-card-img-wrap">
        <Picture image={img} alt={img?.alt || article.title} sizes="(max-width: 768px) 100vw, 360px" />
      </Link>
      <div className="article-card-body">
        {category && <Link href={"/category/" + category.slug} className="article-card-cat">{category.name}</Link>}
        <Link href={href}>
          <h3 className="article-card-title">{article.title}</h3>
        </Link>
        {article.excerpt && <p className="article-card-excerpt">{article.excerpt}</p>}
        <span className="article-card-time">{timeAgo(article.publishedAt)}</span>
      </div>
    </article>
  );
}
