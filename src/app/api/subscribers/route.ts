import { NextResponse } from "next/server";
import { getSubscribers, createSubscriber, updateSubscriberStatus, deleteSubscriber } from "@/lib/data";
import { requireAdmin, errorStatus } from "@/lib/auth";
import { rateLimit } from "@/lib/redis";

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || undefined;
    const status = searchParams.get("status") || undefined;
    const subscribers = await getSubscribers({ search, status });
    return NextResponse.json(subscribers);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to fetch subscribers" }, { status: errorStatus(error) });
  }
}

export async function POST(request: Request) {
  try {
    // Rate limit public subscription: 5 per minute per IP
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const { allowed, remaining } = await rateLimit(`subscribe:${ip}`, 5, 60);
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many subscription attempts. Please try again shortly." },
        { status: 429, headers: { "Retry-After": "60", "X-RateLimit-Remaining": String(remaining) } },
      );
    }

    const { email, sourcePath } = await request.json();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "A valid email address is required." }, { status: 400 });
    }
    const subscriber = await createSubscriber({ email, sourcePath });
    return NextResponse.json(subscriber, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to create subscriber" }, { status: errorStatus(error) });
  }
}

export async function PUT(request: Request) {
  try {
    await requireAdmin();
    const { id, status } = await request.json();
    const subscriber = await updateSubscriberStatus(id, status);
    return NextResponse.json(subscriber);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to update subscriber" }, { status: errorStatus(error) });
  }
}

export async function DELETE(request: Request) {
  try {
    await requireAdmin();
    const { id } = await request.json();
    await deleteSubscriber(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to delete subscriber" }, { status: errorStatus(error) });
  }
}
