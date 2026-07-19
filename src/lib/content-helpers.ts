/**
 * Strip leading image-only paragraphs/figures from HTML content.
 *
 * RSS feeds often include the featured image as the first <p><img></p> in the
 * content body. Since we display the featured image separately, this removes
 * the duplicate.
 */
export function stripLeadingImages(html: string): string {
  if (!html) return "";
  let result = html.trim();
  result = result.replace(/^<p[^>]*>\s*<img[^>]*>\s*<\/p>/i, "");
  result = result.replace(/^<figure[^>]*>\s*<img[^>]*>\s*(<figcaption[^>]*>.*?<\/figcaption>)?\s*<\/figure>/i, "");
  result = result.replace(/^<img[^>]*>/i, "");
  return result.trim();
}

/**
 * Clean RSS agency artifacts from article content:
 *
 * 1. Remove the agency tag from the first line, e.g. "(IANS)" or "(PTI)".
 * 2. Remove trailing agency sign-offs such as "--IANS", "— IANS", "- IANS",
 *    including the byline initials that follow (often garbled).
 *    Handles cases where "--" and "IANS" are on separate lines/paragraphs.
 * 3. Remove standalone agency byline paragraphs at the start or end.
 *
 * IMPORTANT: In-body attributions like "he told IANS" or "Speaking to IANS"
 * are legitimate journalism and must NOT be removed. Only trailing sign-off
 * blocks (dash + IANS + byline initials at the very end) are stripped.
 */
export function stripAgencyArtifacts(html: string): string {
  if (!html) return "";
  let result = html;

  // Remove trailing agency sign-off: dash (possibly in its own paragraph/line),
  // then IANS, then any trailing byline paragraphs.
  // Handles: <p>--IANS aar/ag</p>, <p>--</p><p>IANS</p><p>mkr/</p>,
  // <p>--<br>IANS<br>mkr/</p>, <p>—IANS</p><p>byline</p>, <p>-IANS</p>.
  // The dash is REQUIRED — this prevents matching in-body "told IANS" attributions.
  const trailingSignoff = /(?:<p[^>]*>\s*(?:--|—|–|-)\s*(?:<\/p>\s*|\s*(?:<br\s*\/?>\s*)+))?<(?:p[^>]*|div[^>]*|span[^>]*|br\s*\/?)>\s*IANS(?:\/PIB)?[\s\S]*?(?:<\/p>\s*(?:<p[^>]*>(?:[\s\S]*?)<\/p>\s*)*)?$/i;
  result = result.replace(trailingSignoff, "");

  // Plain-text fallback: REQUIRES a dash before IANS to avoid matching in-body attributions.
  // Dash, optional whitespace/newlines/<br>, then IANS, then anything to end.
  result = result.replace(/(?:--|—|–|-)\s*(?:<br\s*\/?>\s*)*\s*IANS(?:\/PIB)?[\s\S]*?$/i, "");

  // Remove leading standalone agency byline paragraphs, e.g. <p>IANS</p> at the start.
  result = result.replace(/^<p[^>]*>\s*(?:--|—|–|-)?\s*IANS(?:\/PIB)?\s*<\/p>\s*/i, "");

  // Remove agency tag from the first paragraph and replace with a separator.
  result = result.replace(/\s*\((IANS|PTI|ANI|IANS\/PIB)\)\s*/i, " — ");

  // Strip trailing standalone byline-initial gibberish paragraphs at the end,
  // e.g. <p>aar/ag/vm</p>, <p>--xxx</p>, <p>mkr/</p>.
  // Only matches short 2-5 letter tokens with optional slashes — real content won't match.
  result = result.replace(/(?:<p[^>]*>\s*(?:--|—|–)?\s*[a-z]{2,5}(?:\/[a-z]{2,5}){0,4}\s*<\/p>\s*)+$/i, "");
  result = result.replace(/(?:<p[^>]*>\s*[a-z]{2,5}\/\s*<\/p>\s*)+$/i, "");

  return result.trim();
}
