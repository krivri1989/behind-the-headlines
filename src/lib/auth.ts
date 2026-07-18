import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

export type Role = "admin" | "editor";
export type SessionUser = { id: string; email: string; name: string; role: Role };

const sessionCookie = "bth_session";
const secret = () => {
  const value = process.env.AUTH_SECRET;
  if (!value) throw new Error("AUTH_SECRET must be set before using authentication.");
  return new TextEncoder().encode(value);
};

export const hashPassword = (password: string) => bcrypt.hash(password, 12);
export const verifyPassword = (password: string, hash: string) => bcrypt.compare(password, hash);

export async function createSession(user: SessionUser) {
  const token = await new SignJWT(user).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("7d").sign(secret());
  const store = await cookies();
  store.set(sessionCookie, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 7 });
}

export async function getSession(): Promise<SessionUser | null> {
  const token = (await cookies()).get(sessionCookie)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (typeof payload.id !== "string" || typeof payload.email !== "string" || typeof payload.name !== "string" || (payload.role !== "admin" && payload.role !== "editor")) return null;
    return { id: payload.id, email: payload.email, name: payload.name, role: payload.role };
  } catch { return null; }
}

export async function requireSession() {
  const session = await getSession();
  if (!session) throw new Error("Authentication required.");
  return session;
}

export async function requireAdmin() {
  const session = await requireSession();
  if (session.role !== "admin") throw new Error("Administrator access required.");
  return session;
}

export function canManageArticle(user: SessionUser, articleAuthorId: string) {
  return user.role === "admin" || user.id === articleAuthorId;
}
