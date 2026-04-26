import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { verifySession, SESSION_COOKIE } from "@/lib/auth";

export async function DELETE(req: NextRequest) {
  const cookieStore = await cookies();
  const session = await verifySession(cookieStore.get(SESSION_COOKIE)?.value);
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const password = String(body?.password ?? "");
  const confirm = String(body?.confirm ?? "");

  if (!password) {
    return NextResponse.json(
      { error: "비밀번호를 입력해 주세요" },
      { status: 400 }
    );
  }
  if (confirm !== "DELETE") {
    return NextResponse.json(
      { error: "확인 문구가 일치하지 않습니다" },
      { status: 400 }
    );
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, session.userId),
  });
  if (!user) {
    return NextResponse.json(
      { error: "계정을 찾을 수 없습니다" },
      { status: 404 }
    );
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    return NextResponse.json(
      { error: "비밀번호가 일치하지 않습니다" },
      { status: 401 }
    );
  }

  // Cascade: posts, folders, categories, user_fonts all reference users
  // with onDelete: "cascade" — they will be removed automatically.
  await db.delete(users).where(eq(users.id, session.userId));

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
