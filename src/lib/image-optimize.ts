import sharp from "sharp";
import { uploadFile } from "./storage";

/**
 * Responsive breakpoint widths for generated variants.
 * These cover mobile (480), tablet (768), desktop (1024), and large (1920).
 */
export const RESPONSIVE_WIDTHS = [480, 768, 1024, 1920] as const;

/**
 * Output formats to generate for each width.
 * WebP for broad support, AVIF for modern browsers (smaller files).
 */
export const OUTPUT_FORMATS = ["webp", "avif"] as const;

export type ImageVariant = {
  width: number;
  format: "webp" | "avif";
  key: string;
  url: string;
  size: number;
};

export type OptimizedImage = {
  original: { key: string; url: string; width: number; height: number; size: number; contentType: string };
  variants: ImageVariant[];
};

/**
 * Generate optimized image variants (WebP + AVIF at multiple widths) from a source buffer.
 * Uploads all variants to RustFS and returns their keys/URLs.
 *
 * @param originalKey - The S3 key for the original image (e.g. "media/123-abc.jpg")
 * @param buffer - The original image buffer
 * @param contentType - The original content type
 * @returns OptimizedImage with original metadata and all variant URLs
 */
export async function generateImageVariants(
  originalKey: string,
  buffer: Buffer,
  contentType: string,
): Promise<OptimizedImage> {
  // Get original metadata
  const metadata = await sharp(buffer).metadata();
  const originalWidth = metadata.width || 0;
  const originalHeight = metadata.height || 0;

  // Upload the original as-is (keep it for fallback)
  const originalExt = originalKey.split(".").pop() || "jpg";
  const baseKey = originalKey.replace(/\.[^.]+$/, ""); // strip extension

  const variants: ImageVariant[] = [];

  for (const width of RESPONSIVE_WIDTHS) {
    // Skip variants larger than the original
    if (width >= originalWidth) continue;

    for (const format of OUTPUT_FORMATS) {
      try {
        const variantBuffer = await sharp(buffer)
          .resize({ width, withoutEnlargement: true })
          .toFormat(format, { quality: format === "avif" ? 50 : 80 })
          .toBuffer();

        const variantKey = `${baseKey}-${width}w.${format}`;
        const result = await uploadFile(variantKey, variantBuffer, `image/${format}`);
        variants.push({
          width,
          format,
          key: result.key,
          url: result.url,
          size: variantBuffer.length,
        });
      } catch {
        // Skip variant if generation fails (e.g. unsupported source format)
      }
    }
  }

  // Also generate a WebP version at the original width for modern browsers
  if (originalWidth > 0) {
    try {
      const webpOriginal = await sharp(buffer)
        .toFormat("webp", { quality: 80 })
        .toBuffer();
      const webpKey = `${baseKey}-${originalWidth}w.webp`;
      const result = await uploadFile(webpKey, webpOriginal, "image/webp");
      variants.push({
        width: originalWidth,
        format: "webp",
        key: result.key,
        url: result.url,
        size: webpOriginal.length,
      });
    } catch { /* ignore */ }
  }

  return {
    original: {
      key: originalKey,
      url: "", // filled by caller using getObjectUrl
      width: originalWidth,
      height: originalHeight,
      size: buffer.length,
      contentType,
    },
    variants,
  };
}

/**
 * Build a srcset string from image variants for use in <img srcset="...">.
 * Only includes variants of the given format.
 */
export function buildSrcset(variants: ImageVariant[], format: "webp" | "avif"): string {
  return variants
    .filter((v) => v.format === format)
    .map((v) => `${v.url} ${v.width}w`)
    .join(", ");
}

/**
 * Pick the best variant URL for a given target width.
 * Falls back to the original URL if no variants exist.
 */
export function getBestVariantUrl(
  variants: ImageVariant[],
  targetWidth: number,
  format: "webp" | "avif" | "original" = "webp",
  originalUrl?: string,
): string {
  if (format === "original" || variants.length === 0) {
    return originalUrl || "";
  }

  const formatVariants = variants.filter((v) => v.format === format);
  if (formatVariants.length === 0) return originalUrl || "";

  // Find the smallest variant that's >= target width, or the largest available
  const sorted = [...formatVariants].sort((a, b) => a.width - b.width);
  const exact = sorted.find((v) => v.width >= targetWidth);
  return (exact || sorted[sorted.length - 1]).url;
}
