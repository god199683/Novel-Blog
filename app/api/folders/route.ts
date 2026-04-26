import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { folders } from "@/lib/db/schema";
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
    .from(folders)
    .where(eq(folders.userId, session.userId))
    .orderBy(folders.sortOrder, desc(folders.createdAt));

  return NextResponse.json(rows.map((r) => ({ id: r.id, name: r.name })));
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const session = await verifySession(cookieStore.get("session")?.value);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const name = String(body?.name ?? "").trim();
  if (!name || name.length > 30) {
    return NextResponse.json({ error: "폴더 이름은 1-30자" }, { status: 400 });
  }

  const existing = await db.query.folders.findFirst({
    where: and(eq(folders.userId, session.userId), eq(folders.name, name)),
  });
  if (existing) {
    return NextResponse.json({ error: "이미 존재하는 폴더" }, { status: 409 });
  }

  const id = makeId();
  const count = await db
    .select()
    .from(folders)
    .where(eq(folders.userId, session.userId));
  await db.insert(folders).values({
    id,
    userId: session.userId,
    name,
    sortOrder: count.length,
  });
  return NextResponse.json({ id, name });
}
