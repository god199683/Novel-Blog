import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { categories } from "@/lib/db/schema";
import { verifySession } from "@/lib/auth";
import { eq } from "drizzle-orm";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const cookieStore = await cookies();
  const session = await verifySession(cookieStore.get("session")?.value);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const cat = await db.query.categories.findFirst({
    where: eq(categories.id, id),
  });
  if (!cat) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (cat.userId !== session.userId)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await db.delete(categories).where(eq(categories.id, id));
  return NextResponse.json({ ok: true });
}
