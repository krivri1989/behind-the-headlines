import { connectToDatabase } from "@/lib/db";
import { Page } from "@/lib/models";
import { getSiteSettingsPublic } from "@/lib/public-data";
import { processVideoEmbeds } from "@/lib/video-embeds";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const revalidate = 300;

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  await connectToDatabase();
  const page = await Page.findOne({ slug, status: "published" }).lean() as unknown as { title: string; seoTitle?: string; seoDescription?: string; excerpt?: string } | null;
  if (!page) return { title: "Page Not Found" };

  const settings = await getSiteSettingsPublic();
  const name = (settings?.publicationName as string) || "Behind The Headlines";
  const title = page.seoTitle || page.title;
  const description = page.seoDescription || page.excerpt || "";

  return {
    title,
    description,
    alternates: { canonical: "/page/" + slug },
    openGraph: {
      type: "website",
      title,
      description,
      siteName: name,
      url: "/page/" + slug,
    },
  };
}

export default async function PublicPage({ params }: Props) {
  const { slug } = await params;
  await connectToDatabase();
  const page = await Page.findOne({ slug, status: "published" }).lean() as unknown as { _id: unknown; title: string; content: string; excerpt: string; updatedAt: string } | null;
  if (!page) notFound();

  return (
    <div className="static-page">
      <nav className="breadcrumb">
        <Link href="/">Home</Link>
        <span className="breadcrumb-sep">/</span>
        <span className="breadcrumb-current">{page.title}</span>
      </nav>

      <article className="static-page-content">
        <h1 className="static-page-title">{page.title}</h1>
        {page.excerpt && <p className="static-page-excerpt">{page.excerpt}</p>}
        <div className="article-content" dangerouslySetInnerHTML={{ __html: processVideoEmbeds(page.content) }} />
      </article>
    </div>
  );
}
