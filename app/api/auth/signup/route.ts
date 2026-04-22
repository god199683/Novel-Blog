import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, categories } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { createSession, SESSION_COOKIE } from "@/lib/auth";
import { makeId, validateUsername } from "@/lib/slug";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const username = String(body.username ?? "").toLowerCase().trim();
  const displayName = String(body.displayName ?? "").trim();
  const password = String(body.password ?? "");

  if (!validateUsername(username)) {
    return NextResponse.json(
      { error: "아이디는 영문 소문자/숫자/언더스코어 3-20자" },
      { status: 400 }
    );
  }
  if (displayName.length < 1 || displayName.length > 40) {
    return NextResponse.json({ error: "필명은 1-40자" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "비밀번호는 8자 이상" }, { status: 400 });
  }

  const existingUsername = await db.query.users.findFirst({
    where: eq(users.username, username),
  });
  if (existingUsername) {
    return NextResponse.json({ error: "이미 사용 중인 아이디" }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const id = makeId();
  await db.insert(users).values({
    id,
    username,
    displayName,
    email: null,
    passwordHash,
    blogTitle: `${displayName}의 블로그`,
  });

  // Default categories for new users
  const defaults = ["장편", "단편", "에세이", "기타"];
  await db.insert(categories).values(
    defaults.map((name, i) => ({
      id: makeId(),
      userId: id,
      name,
      sortOrder: i,
    }))
  );

  const token = await createSession({ userId: id, username, displayName });
  const res = NextResponse.json({ ok: true, username });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
