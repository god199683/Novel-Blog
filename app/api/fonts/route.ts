import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { userFonts } from "@/lib/db/schema";
import { verifySession } from "@/lib/auth";
import { makeId } from "@/lib/slug";
import { eq, and, desc } from "drizzle-orm";

export async function GET() {
  const cookieStore = await cookies();
  const session = await verifySession(cookieStore.get("session")?.value);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db
    .select()
    .from(userFonts)
    .where(eq(userFonts.userId, session.userId))
    .orderBy(desc(userFonts.createdAt));

  return NextResponse.json(rows.map((r) => ({ id: r.id, name: r.name })));
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const session = await verifySession(cookieStore.get("session")?.value);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const name = String(body?.name ?? "").trim();
  if (!name || name.length > 60) {
    return NextResponse.json({ error: "폰트 이름은 1-60자" }, { status: 400 });
  }

  const existing = await db.query.userFonts.findFirst({
    where: and(eq(userFonts.userId, session.userId), eq(userFonts.name, name)),
  });
  if (existing) {
    return NextResponse.json({ error: "이미 추가된 폰트" }, { status: 409 });
  }

  const id = makeId();
  await db.insert(userFonts).values({
    id,
    userId: session.userId,
    name,
  });
  return NextResponse.json({ id, name });
}
