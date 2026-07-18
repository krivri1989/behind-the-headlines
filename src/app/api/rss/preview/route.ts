import { XMLParser } from "fast-xml-parser";
import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/redis";

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", trimValues: true });
const privateHost = (hostname: string) => hostname === "localhost" || hostname.endsWith(".local") || /^127\.|^10\.|^192\.168\.|^169\.254\.|^0\./.test(hostname) || /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname) || hostname === "::1";
const text = (value: unknown) => typeof value === "string" ? value : value && typeof value === "object" && "#text" in value ? String(value["#text" as keyof typeof value]) : "";
const imageFromDescription = (description: string) => {
  const match = description.match(/<img\b[^>]*\bsrc=["']([^"']+)["']/i);
  return match?.[1] ?? "";
};

export async function POST(request: Request) {
  try {
    // Rate limit: 10 feed previews per minute per IP
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const { allowed } = await rateLimit(`rss-preview:${ip}`, 10, 60);
    if (!allowed) return NextResponse.json({ error: "Too many preview requests. Please try again shortly." }, { status: 429, headers: { "Retry-After": "60" } });

    const { feedUrl } = await request.json() as { feedUrl?: string };
    if (!feedUrl) return NextResponse.json({ error: "Enter an RSS feed URL." }, { status: 400 });
    const url = new URL(feedUrl);
    if (!/^https?:$/.test(url.protocol) || privateHost(url.hostname)) return NextResponse.json({ error: "Use a public HTTP or HTTPS feed URL." }, { status: 400 });
    const response = await fetch(url, { headers: { Accept: "application/rss+xml, application/xml, text/xml" }, signal: AbortSignal.timeout(10_000), redirect: "follow", cache: "no-store" });
    if (!response.ok) return NextResponse.json({ error: `The feed responded with ${response.status}.` }, { status: 422 });
    const document = parser.parse(await response.text());
    const channel = document.rss?.channel ?? document.feed;
    const rawItems = channel?.item ?? channel?.entry ?? [];
    const items = (Array.isArray(rawItems) ? rawItems : [rawItems]).slice(0, 10).map((item: Record<string, unknown>) => {
      const summary = text(item.description) || text(item.summary) || text(item.content).slice(0, 240) || "";
      return { title: text(item.title) || "Untitled item", link: text(item.link) || text(item.guid) || "", publishedAt: text(item.pubDate) || text(item.published) || text(item.updated) || "", summary, imageUrl: imageFromDescription(summary) };
    });
    return NextResponse.json({ title: text(channel?.title) || url.hostname, items });
  } catch {
    return NextResponse.json({ error: "The feed could not be fetched or parsed. Confirm the URL serves a public RSS or Atom XML feed." }, { status: 422 });
  }
}
