/**
 * Convert video URLs from supported platforms (YouTube, Instagram, Facebook, X/Twitter)
 * into responsive embed iframes within article HTML content.
 *
 * Supported URL formats:
 *   YouTube:    youtu.be/ID, youtube.com/watch?v=ID, youtube.com/embed/ID, youtube.com/shorts/ID
 *   Instagram:  instagram.com/reel/ID/, instagram.com/p/ID/
 *   Facebook:   facebook.com/share/r/ID/, facebook.com/watch?v=ID, facebook.com/USER/videos/ID/
 *   X/Twitter:  x.com/USER/status/ID, twitter.com/USER/status/ID (works for both video and post)
 *
 * The function processes already-sanitized HTML and only adds iframe embeds from
 * trusted provider domains. It runs at render time so stored content is not modified.
 */

/** Extract YouTube video ID from any YouTube URL format. */
function extractYouTubeId(url: string): string | null {
  // youtu.be/VIDEO_ID
  let m = url.match(/youtu\.be\/([a-zA-Z0-9_-]{6,})/);
  if (m) return m[1];
  // youtube.com/watch?v=VIDEO_ID
  m = url.match(/[?&]v=([a-zA-Z0-9_-]{6,})/);
  if (m) return m[1];
  // youtube.com/embed/VIDEO_ID
  m = url.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{6,})/);
  if (m) return m[1];
  // youtube.com/shorts/VIDEO_ID
  m = url.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]{6,})/);
  if (m) return m[1];
  // youtube.com/live/VIDEO_ID
  m = url.match(/youtube\.com\/live\/([a-zA-Z0-9_-]{6,})/);
  if (m) return m[1];
  return null;
}

/** Extract Instagram reel/post ID. */
function extractInstagramId(url: string): string | null {
  const m = url.match(/instagram\.com\/(?:reel|reels|p)\/([a-zA-Z0-9_-]+)/);
  return m ? m[1] : null;
}

/** Check if a URL is a Facebook video URL. */
function isFacebookVideoUrl(url: string): boolean {
  if (!/facebook\.com\//.test(url)) return false;
  // Match known video URL patterns
  return (
    /facebook\.com\/share\/r\//.test(url) ||
    /facebook\.com\/share\/v\//.test(url) ||
    /facebook\.com\/watch\?/.test(url) ||
    /facebook\.com\/video\.php\?/.test(url) ||
    /facebook\.com\/[^/]+\/videos\//.test(url) ||
    /facebook\.com\/video\/video\.php\?/.test(url) ||
    /fb\.watch\//.test(url)
  );
}

/** Extract X/Twitter status ID. */
function extractTwitterId(url: string): string | null {
  const m = url.match(/(?:x\.com|twitter\.com)\/[^/]+\/status\/(\d+)/);
  return m ? m[1] : null;
}

function buildYouTubeEmbed(url: string, videoId: string): string {
  const isShorts = /\/shorts\//.test(url);
  const className = isShorts ? "video-embed video-embed-short" : "video-embed video-embed-wide";
  return `<figure class="${className}"><iframe src="https://www.youtube.com/embed/${videoId}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen loading="lazy"></iframe></figure>`;
}

function buildInstagramEmbed(videoId: string): string {
  return `<figure class="video-embed video-embed-instagram"><iframe src="https://www.instagram.com/reel/${videoId}/embed/" frameborder="0" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen loading="lazy"></iframe></figure>`;
}

function buildFacebookEmbed(url: string): string {
  const encoded = encodeURIComponent(url);
  return `<figure class="video-embed video-embed-facebook"><iframe src="https://www.facebook.com/plugins/video.php?href=${encoded}&show_text=false&width=560&t=0" frameborder="0" allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share" allowfullscreen loading="lazy"></iframe></figure>`;
}

function buildTwitterEmbed(statusId: string): string {
  return `<figure class="video-embed video-embed-twitter"><iframe src="https://platform.twitter.com/embed/Tweet.html?id=${statusId}" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen loading="lazy"></iframe></figure>`;
}

/** Convert a single video URL to an embed HTML string, or null if not a video URL. */
function urlToEmbed(url: string): string | null {
  const cleanUrl = url.trim().replace(/[.,;:)]+$/, "");

  // YouTube
  const ytId = extractYouTubeId(cleanUrl);
  if (ytId) return buildYouTubeEmbed(cleanUrl, ytId);

  // Instagram
  const igId = extractInstagramId(cleanUrl);
  if (igId) return buildInstagramEmbed(igId);

  // Facebook
  if (isFacebookVideoUrl(cleanUrl)) return buildFacebookEmbed(cleanUrl);

  // X/Twitter (video or regular post)
  const twId = extractTwitterId(cleanUrl);
  if (twId) return buildTwitterEmbed(twId);

  return null;
}

/**
 * Process HTML content and replace video URLs from supported platforms with
 * responsive embed iframes. Handles both bare-text URLs and <a> tags linking
 * to video URLs.
 *
 * @param html - Sanitized HTML content
 * @returns HTML with video URLs replaced by embed iframes
 */
export function processVideoEmbeds(html: string): string {
  if (!html) return "";

  // Pass 1: Replace <a> tags whose href points to a video URL.
  // Matches: <a href="VIDEO_URL" ...>text</a>
  html = html.replace(/<a\s+[^>]*href="([^"]+)"[^>]*>([^<]*)<\/a>/gi, (match, href: string) => {
    const embed = urlToEmbed(href);
    return embed || match;
  });

  // Pass 2: Replace bare-text video URLs (not inside HTML attributes).
  // A bare URL in text content is preceded by start-of-string, whitespace, or ">"
  // (end of an opening/closing tag). The URL itself stops at whitespace, "<", or quotes.
  // Trailing punctuation (.,;:)) is separated from the URL so it stays in the text.
  html = html.replace(/(^|[\s>])(https?:\/\/[^\s<"'&]+)/gm, (match, prefix: string, url: string) => {
    const trailingMatch = url.match(/[.,;:)]+$/);
    const trailing = trailingMatch ? trailingMatch[0] : "";
    const cleanUrl = trailing ? url.slice(0, -trailing.length) : url;
    const embed = urlToEmbed(cleanUrl);
    return embed ? prefix + embed + trailing : match;
  });

  return html;
}
