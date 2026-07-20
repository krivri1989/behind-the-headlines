import { NextResponse } from "next/server";
import { requireAdmin, errorStatus } from "@/lib/auth";
import { uploadFile, isStorageConfigured } from "@/lib/storage";

/**
 * Admin-only ad creative upload to RustFS.
 * Accepts images (jpeg, png, webp, gif, avif) and videos (mp4).
 * Returns: { url: string, key: string }
 */
export async function POST(request: Request) {
  try {
    await requireAdmin();
    if (!isStorageConfigured()) {
      return NextResponse.json({ error: "Storage is not configured." }, { status: 503 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file provided." }, { status: 400 });

    const allowedTypes = [
      "image/jpeg", "image/png", "image/webp", "image/gif", "image/avif",
      "video/mp4",
    ];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: "Only image (jpeg, png, webp, gif, avif) and video (mp4) files are allowed." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = file.name.split(".").pop() || "bin";
    const key = `ads/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const result = await uploadFile(key, buffer, file.type);

    return NextResponse.json({ url: result.url, key: result.key }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to upload ad creative" }, { status: errorStatus(error) });
  }
}
