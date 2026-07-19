"use client";

import Link from "next/link";
import { useState } from "react";
import type { PublicArticle } from "@/lib/public-data";
import { useSiteSettings } from "@/components/site-settings-provider";

function CardImage({ src, alt, fallback }: { src: string; alt: string; fallback?: string }) {
  const [error, setError] = useState(false);
  const effectiveSrc = error && fallback && fallback !== src ? fallback : src;
  if ((error && !fallback) || !effectiveSrc) return <div className="article-card-img placeholder" />;
  return (
    <img
      src={effectiveSrc}
      alt={alt}
      loading="lazy"
      onError={() => setError(true)}
    />
  );
}

function Picture({ image, alt, sizes, fallback }: { image: PublicArticle["featuredImage"]; alt: string; sizes: string; fallback?: string }) {
  const [srcsetFailed, setSrcsetFailed] = useState(false);

  if (!image?.url) {
    if (fallback) return <CardImage src={fallback} alt={alt} />;
    return <div className="article-card-img placeholder" />;
  }

  const webpVariants = image.variants.filter((v) => v.format === "webp");
  const avifVariants = image.variants.filter((v) => v.format === "avif");
  const srcsetWebp = webpVariants.map((v) => v.url + " " + v.width + "w").join(", ");
  const srcsetAvif = avifVariants.map((v) => v.url + " " + v.width + "w").join(", ");

  // If the featured image (and any of its variants) fails to load, drop the
  // <source> srcsets and render a plain <img> that can fall back to the default image.
  if (srcsetFailed) return <CardImage src={image.url} alt={alt} fallback={fallback} />;

  return (
    <picture>
      {srcsetAvif && <source type="image/avif" srcSet={srcsetAvif} sizes={sizes} />}
      {srcsetWebp && <source type="image/webp" srcSet={srcsetWebp} sizes={sizes} />}
      <img src={image.url} alt={alt} loading="lazy" onError={() => setSrcsetFailed(true)} />
    </picture>
  );
}

export function ArticleCard({ article, variant = "default" }: { article: PublicArticle; variant?: "default" | "lead" | "horizontal" | "compact" | "text" | "image-title" }) {
  const { defaultImageUrl } = useSiteSettings();
  const href = "/article/" + article.slug;
  const category = article.categories[0];
  const img: PublicArticle["featuredImage"] = article.featuredImage || (defaultImageUrl
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

  if (variant === "image-title") {
    return (
      <article className="article-card default image-title-only">
        <Link href={href} className="article-card-img-wrap">
          <Picture image={img} alt={img?.alt || article.title} sizes="(max-width: 768px) 100vw, 300px" fallback={defaultImageUrl} />
        </Link>
        <div className="article-card-body">
          <Link href={href}>
            <h3 className="article-card-title">{article.title}</h3>
          </Link>
        </div>
      </article>
    );
  }

  if (variant === "text") {
    return (
      <article className="article-card text-only">
        {category && <Link href={"/category/" + category.slug} className="article-card-cat">{category.name}</Link>}
        <Link href={href}>
          <h3 className="article-card-title">{article.title}</h3>
        </Link>

      </article>
    );
  }

  if (variant === "compact") {
    return (
      <article className="article-card compact">
        {img?.url && (
          <Link href={href} className="article-card-img-wrap">
            <Picture image={img} alt={img.alt || article.title} sizes="120px" fallback={defaultImageUrl} />
          </Link>
        )}
        <div className="article-card-body">
          <Link href={href}>
            <h3 className="article-card-title">{article.title}</h3>
          </Link>
  
        </div>
      </article>
    );
  }

  if (variant === "horizontal") {
    return (
      <article className="article-card horizontal">
        <Link href={href} className="article-card-img-wrap">
          <Picture image={img} alt={img?.alt || article.title} sizes="300px" fallback={defaultImageUrl} />
        </Link>
        <div className="article-card-body">
          {category && <Link href={"/category/" + category.slug} className="article-card-cat">{category.name}</Link>}
          <Link href={href}>
            <h3 className="article-card-title">{article.title}</h3>
          </Link>
          {article.excerpt && <p className="article-card-excerpt">{article.excerpt}</p>}
  
        </div>
      </article>
    );
  }

  if (variant === "lead") {
    return (
      <article className="article-card lead">
        <Link href={href} className="article-card-img-wrap">
          <Picture image={img} alt={img?.alt || article.title} sizes="(max-width: 768px) 100vw, 720px" fallback={defaultImageUrl} />
        </Link>
        <div className="article-card-body">
          {category && <Link href={"/category/" + category.slug} className="article-card-cat">{category.name}</Link>}
          <Link href={href}>
            <h2 className="article-card-title lead-title">{article.title}</h2>
          </Link>
          {article.excerpt && <p className="article-card-excerpt">{article.excerpt}</p>}
          <div className="article-card-meta">
            <span>By {article.author.name}</span>
    
          </div>
        </div>
      </article>
    );
  }

  // default
  return (
    <article className="article-card default">
      <Link href={href} className="article-card-img-wrap">
        <Picture image={img} alt={img?.alt || article.title} sizes="(max-width: 768px) 100vw, 360px" fallback={defaultImageUrl} />
      </Link>
      <div className="article-card-body">
        {category && <Link href={"/category/" + category.slug} className="article-card-cat">{category.name}</Link>}
        <Link href={href}>
          <h3 className="article-card-title">{article.title}</h3>
        </Link>
        {article.excerpt && <p className="article-card-excerpt">{article.excerpt}</p>}

      </div>
    </article>
  );
}
