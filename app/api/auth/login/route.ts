import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { createSession, SESSION_COOKIE } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const identifier = String(body.identifier ?? "").toLowerCase().trim();
  const password = String(body.password ?? "");

  if (!identifier || !password) {
    return NextResponse.json({ error: "아이디와 비밀번호를 입력해 주세요" }, { status: 400 });
  }

  const user =
    (await db.query.users.findFirst({ where: eq(users.username, identifier) })) ??
    (await db.query.users.findFirst({ where: eq(users.email, identifier) }));

  if (!user) {
    return NextResponse.json({ error: "계정을 찾을 수 없어요" }, { status: 401 });
  }
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    return NextResponse.json({ error: "비밀번호가 틀렸어요" }, { status: 401 });
  }

  const token = await createSession({
    userId: user.id,
    username: user.username,
    displayName: user.displayName,
  });
  const res = NextResponse.json({ ok: true, username: user.username });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
