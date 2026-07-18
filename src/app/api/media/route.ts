import { NextResponse } from "next/server";
import { getMediaLibrary, createMediaRecord, deleteMedia, updateMedia, syncMediaFromStorage } from "@/lib/data";
import { getSession } from "@/lib/auth";
import { uploadFile, isStorageConfigured, getObjectUrl } from "@/lib/storage";
import { generateImageVariants } from "@/lib/image-optimize";

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || undefined;
    const page = Number(searchParams.get("page")) || 1;
    const limit = Number(searchParams.get("limit")) || 50;

    // Sync any missing objects from RustFS into the Media collection
    try {
      await syncMediaFromStorage();
    } catch { /* ignore sync errors, still return what we have */ }

    const result = await getMediaLibrary({ search, page, limit });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to fetch media" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    if (!isStorageConfigured()) return NextResponse.json({ error: "Storage is not configured." }, { status: 503 });

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file provided." }, { status: 400 });

    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];
    if (!allowedTypes.includes(file.type)) return NextResponse.json({ error: "Only image files are allowed." }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = file.name.split(".").pop() || "jpg";
    const key = `media/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const result = await uploadFile(key, buffer, file.type);

    // Generate optimized variants (WebP + AVIF at multiple widths)
    let variants: { width: number; format: "webp" | "avif"; key: string; url: string; size: number }[] = [];
    let imgWidth = 0;
    let imgHeight = 0;
    try {
      const optimized = await generateImageVariants(key, buffer, file.type);
      variants = optimized.variants;
      imgWidth = optimized.original.width;
      imgHeight = optimized.original.height;
    } catch { /* variant generation is best-effort */ }

    const media = await createMediaRecord({
      key: result.key,
      url: result.url,
      filename: file.name,
      contentType: file.type,
      size: file.size,
      uploadedById: session.id,
      width: imgWidth,
      height: imgHeight,
      variants,
    });
    return NextResponse.json(media, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to upload media" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    const { id, ...input } = await request.json();
    const media = await updateMedia(id, input);
    return NextResponse.json(media);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to update media" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    const { id } = await request.json();
    await deleteMedia(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to delete media" }, { status: 500 });
  }
}
