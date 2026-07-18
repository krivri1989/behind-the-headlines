import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { User } from "@/lib/models";
import { verifyPassword, createSession } from "@/lib/auth";
import { rateLimit } from "@/lib/redis";

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();
    if (!email || !password) return NextResponse.json({ error: "Email and password are required." }, { status: 400 });

    // Rate limit: 10 login attempts per minute per IP
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const { allowed, remaining } = await rateLimit(`login:${ip}`, 10, 60);
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many login attempts. Please try again in a minute." },
        { status: 429, headers: { "Retry-After": "60", "X-RateLimit-Remaining": String(remaining) } },
      );
    }

    await connectToDatabase();
    const user = await User.findOne({ email: email.trim().toLowerCase() });
    if (!user) return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    if (!user.active) return NextResponse.json({ error: "This account has been deactivated." }, { status: 403 });

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });

    await createSession({ id: String(user._id), email: user.email, name: user.name, role: user.role });
    return NextResponse.json({ id: String(user._id), email: user.email, name: user.name, role: user.role });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Login failed" }, { status: 500 });
  }
}
