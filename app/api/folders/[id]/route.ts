import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { folders } from "@/lib/db/schema";
import { verifySession } from "@/lib/auth";
import { eq, and } from "drizzle-orm";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const cookieStore = await cookies();
  const session = await verifySession(cookieStore.get("session")?.value);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const folder = await db.query.folders.findFirst({
    where: eq(folders.id, id),
  });
  if (!folder) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (folder.userId !== session.userId)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const name = String(body?.name ?? "").trim();
  if (!name || name.length > 30) {
    return NextResponse.json({ error: "폴더 이름은 1-30자" }, { status: 400 });
  }

  const dup = await db.query.folders.findFirst({
    where: and(eq(folders.userId, session.userId), eq(folders.name, name)),
  });
  if (dup && dup.id !== id) {
    return NextResponse.json({ error: "이미 존재하는 폴더" }, { status: 409 });
  }

  await db.update(folders).set({ name }).where(eq(folders.id, id));
  return NextResponse.json({ id, name });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const cookieStore = await cookies();
  const session = await verifySession(cookieStore.get("session")?.value);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const folder = await db.query.folders.findFirst({
    where: eq(folders.id, id),
  });
  if (!folder) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (folder.userId !== session.userId)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await db.delete(folders).where(eq(folders.id, id));
  return NextResponse.json({ ok: true });
}
