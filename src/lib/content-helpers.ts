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
 * 2. Remove trailing agency sign-offs such as "--IANS", "—IANS", "-IANS",
 *    including the byline initials that follow.
 */
export function stripAgencyArtifacts(html: string): string {
  if (!html) return "";
  let result = html;

  // Remove trailing agency sign-off and any following byline initials.
  // Matches: <p>--IANS aar/ag</p>, <p>—IANS</p><p>byline</p>, <p>-IANS</p>,
  // and plain text versions, including em/en dash prefixes.
  const trailingSignoff = /<p[^>]*>\s*(?:--|—|–|-)\s*IANS(?:\/PIB)?\s*(?:<[^>]+>\s*)*[\s\S]*?<\/p>\s*(?:<p[^>]*>(?:[\s\S]*?)<\/p>\s*)*$/i;
  result = result.replace(trailingSignoff, "");
  result = result.replace(/(?:--|—|–|-)\s*IANS(?:\/PIB)?[\s\S]*?$/i, "");

  // Remove agency tag from the first paragraph and replace with a separator.
  result = result.replace(/\s*\((IANS|PTI|ANI|IANS\/PIB)\)\s*/i, " — ");

  return result.trim();
}
