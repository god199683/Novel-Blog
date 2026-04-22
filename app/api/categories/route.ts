import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { categories } from "@/lib/db/schema";
import { verifySession } from "@/lib/auth";
import { makeId } from "@/lib/slug";
import { eq, and, desc } from "drizzle-orm";

export async function GET() {
  const cookieStore = await cookies();
  const session = await verifySession(cookieStore.get("session")?.value);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let rows = await db
    .select()
    .from(categories)
    .where(eq(categories.userId, session.userId))
    .orderBy(categories.sortOrder, desc(categories.createdAt));

  // Seed defaults for users who signed up before categories existed
  if (rows.length === 0) {
    const defaults = ["장편", "단편", "에세이", "기타"];
    const newRows = defaults.map((name, i) => ({
      id: makeId(),
      userId: session.userId,
      name,
      sortOrder: i,
      createdAt: new Date(),
    }));
    await db.insert(categories).values(newRows);
    rows = newRows;
  }

  return NextResponse.json(
    rows.map((r) => ({ id: r.id, name: r.name }))
  );
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const session = await verifySession(cookieStore.get("session")?.value);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const name = String(body?.name ?? "").trim();
  if (!name || name.length > 30) {
    return NextResponse.json({ error: "카테고리 이름은 1-30자" }, { status: 400 });
  }

  const existing = await db.query.categories.findFirst({
    where: and(eq(categories.userId, session.userId), eq(categories.name, name)),
  });
  if (existing) {
    return NextResponse.json({ error: "이미 존재하는 카테고리" }, { status: 409 });
  }

  const id = makeId();
  const count = await db
    .select()
    .from(categories)
    .where(eq(categories.userId, session.userId));
  await db.insert(categories).values({
    id,
    userId: session.userId,
    name,
    sortOrder: count.length,
  });
  return NextResponse.json({ id, name });
}
