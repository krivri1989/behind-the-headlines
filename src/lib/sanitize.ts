import sanitizeHtml from "sanitize-html";
import { stripLeadingImages, stripAgencyArtifacts } from "./content-helpers";

export { stripLeadingImages, stripAgencyArtifacts };

/**
 * Sanitize HTML content from RSS feeds before storing in the database.
 *
 * This removes dangerous elements (scripts, iframes, event handlers, etc.)
 * while preserving safe editorial formatting. It also normalizes messy
 * RSS HTML into clean, consistent markup.
 *
 * @param html - Raw HTML from an RSS feed item
 * @returns Sanitized HTML safe for storage and rendering
 */
export function sanitizeRssContent(html: string): string {
  if (!html) return "";

  return sanitizeHtml(html, {
    allowedTags: [
      // Text formatting
      "p", "br", "hr", "strong", "b", "em", "i", "u", "s", "del", "ins", "mark", "small", "sub", "sup",
      // Headings
      "h1", "h2", "h3", "h4", "h5", "h6",
      // Lists
      "ul", "ol", "li",
      // Links
      "a",
      // Images (we re-host these, but keep the tag)
      "img",
      // Quotes and code
      "blockquote", "q", "cite", "code", "pre", "kbd", "samp",
      // Tables
      "table", "thead", "tbody", "tfoot", "tr", "th", "td",
      // Semantic
      "figure", "figcaption", "abbr", "address", "time", "details", "summary",
      // Divs and spans for structure
      "div", "span",
    ],
    allowedAttributes: {
      a: ["href", "title", "target", "rel"],
      img: ["src", "alt", "title", "width", "height", "loading"],
      table: ["class"],
      th: ["scope", "colspan", "rowspan"],
      td: ["colspan", "rowspan"],
      time: ["datetime"],
      abbr: ["title"],
      "*": ["class"], // allow class on all elements for styling
    },
    allowedSchemes: ["http", "https", "mailto"],
    // Force rel="noopener noreferrer" on all external links
    transformTags: {
      a: (tagName, attribs) => {
        const href = attribs.href || "";
        if (href.startsWith("http://") || href.startsWith("https://")) {
          return {
            tagName,
            attribs: {
              ...attribs,
              target: "_blank",
              rel: "noopener noreferrer nofollow",
            },
          };
        }
        return { tagName, attribs };
      },
      img: (tagName, attribs) => {
        return {
          tagName,
          attribs: {
            ...attribs,
            loading: "lazy",
          },
        };
      },
    },
    // Remove all CSS that could be dangerous
    allowedStyles: {},
    // Disallow unknown protocols
    allowProtocolRelative: false,
    // Enforce a reasonable size limit
    textFilter: (text) => text,
    // Remove empty paragraphs and divs that add noise
    exclusiveFilter: (frame) => {
      // Remove elements that contain only whitespace
      if (frame.tag === "p" || frame.tag === "div" || frame.tag === "span") {
        const text = frame.text.trim();
        if (!text) return true;
      }
      return false;
    },
  });
}

/**
 * Sanitize editor-authored content.
 * Editors are trusted users, but we still strip scripts and event handlers
 * to prevent XSS. Allows more formatting freedom than RSS sanitization.
 *
 * @param html - HTML from the rich text editor
 * @returns Sanitized HTML safe for storage and rendering
 */
export function sanitizeEditorContent(html: string): string {
  if (!html) return "";

  return sanitizeHtml(html, {
    allowedTags: [
      "p", "br", "hr", "strong", "b", "em", "i", "u", "s", "del", "ins", "mark", "small", "sub", "sup",
      "h1", "h2", "h3", "h4", "h5", "h6",
      "ul", "ol", "li",
      "a", "img",
      "blockquote", "q", "cite", "code", "pre", "kbd", "samp",
      "table", "thead", "tbody", "tfoot", "tr", "th", "td",
      "figure", "figcaption", "abbr", "address", "time", "details", "summary",
      "div", "span",
    ],
    allowedAttributes: {
      a: ["href", "title", "target", "rel"],
      img: ["src", "alt", "title", "width", "height", "loading"],
      table: ["class"],
      th: ["scope", "colspan", "rowspan"],
      td: ["colspan", "rowspan"],
      time: ["datetime"],
      abbr: ["title"],
      "*": ["class", "style"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    allowedStyles: {
      "*": {
        // Allow basic text styling from the rich text editor
        "text-align": [/^(left|center|right|justify)$/],
        "font-weight": [/^(bold|normal|\d+)$/],
        "font-style": [/^(italic|normal)$/],
        "text-decoration": [/^(underline|line-through|none)$/],
        "color": [/^#?[0-9a-fA-F]{3,8}$/],
        "background-color": [/^#?[0-9a-fA-F]{3,8}$/],
      },
    },
    allowProtocolRelative: false,
    transformTags: {
      a: (tagName, attribs) => {
        const href = attribs.href || "";
        if (href.startsWith("http://") || href.startsWith("https://")) {
          return {
            tagName,
            attribs: { ...attribs, target: "_blank", rel: "noopener noreferrer" },
          };
        }
        return { tagName, attribs };
      },
      img: (tagName, attribs) => ({
        tagName,
        attribs: { ...attribs, loading: "lazy" },
      }),
    },
  });
}

/**
 * Strip all HTML tags and return plain text.
 * Used for generating excerpts from RSS content.
 *
 * @param html - HTML content
 * @param maxLength - Maximum length of the returned text
 * @returns Plain text excerpt
 */
export function htmlToExcerpt(html: string, maxLength = 300): string {
  if (!html) return "";
  const text = sanitizeHtml(html, {
    allowedTags: [],
    allowedAttributes: {},
  }).trim();
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).replace(/\s+\S*$/, "") + "…";
}


