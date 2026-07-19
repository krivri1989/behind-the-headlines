import { getArticleBySlug, getRelatedArticles, getSiteSettingsPublic, getNextArticle, getPreviousArticle } from "@/lib/public-data";
import { ArticleReader } from "@/components/article-reader";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const revalidate = 300;

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const [article, settings] = await Promise.all([
    getArticleBySlug(slug),
    getSiteSettingsPublic(),
  ]);
  if (!article) return { title: "Article Not Found" };

  const name = (settings?.publicationName as string) || "Behind The Headlines";
  const canonicalHost = (settings?.canonicalHost as string) || "";
  const title = article.seoTitle || article.title;
  const description = article.seoDescription || article.excerpt;
  const image = article.featuredImage;
  const url = canonicalHost ? canonicalHost + "/article/" + article.slug : "/article/" + article.slug;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      title,
      description,
      url,
      siteName: name,
      images: image ? [{ url: image.url, width: image.width || 1200, height: image.height || 630, alt: image.alt }] : [],
      publishedTime: article.publishedAt,
      modifiedTime: article.updatedAt,
      authors: [article.author.name],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: image ? [image.url] : [],
    },
    authors: [{ name: article.author.name }],
  };
}

export default async function ArticlePage({ params }: Props) {
  const { slug } = await params;
  const article = await getArticleBySlug(slug);
  if (!article) notFound();

  const [settings, related, nextArticle, prevArticle] = await Promise.all([
    getSiteSettingsPublic(),
    getRelatedArticles(article.id, article.categories.map((c) => c.id), 6),
    getNextArticle(article.id, article.categories.map((c) => c.id)),
    getPreviousArticle(article.id, article.categories.map((c) => c.id)),
  ]);

  const publicationName = (settings?.publicationName as string) || "Behind The Headlines";
  const primaryCategory = article.categories[0];
  const commentsEnabled = Boolean(settings?.enableComments);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: article.title,
    description: article.seoDescription || article.excerpt,
    image: article.featuredImage ? [article.featuredImage.url] : undefined,
    datePublished: article.publishedAt,
    dateModified: article.updatedAt,
    author: { "@type": "Person", name: article.author.name },
    publisher: { "@type": "Organization", name: publicationName },
    mainEntityOfPage: { "@type": "WebPage", "@id": "/article/" + article.slug },
    articleSection: primaryCategory?.name,
  };

  return (
    <div className="article-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <nav className="breadcrumb">
        <Link href="/">Home</Link>
        {primaryCategory && (
          <>
            <span className="breadcrumb-sep">/</span>
            <Link href={"/category/" + primaryCategory.slug}>{primaryCategory.name}</Link>
          </>
        )}
        <span className="breadcrumb-sep">/</span>
        <span className="breadcrumb-current">{article.title}</span>
      </nav>

      <ArticleReader initialArticle={article} related={related} prevArticle={prevArticle} nextArticle={nextArticle} commentsEnabled={commentsEnabled} />
    </div>
  );
}
