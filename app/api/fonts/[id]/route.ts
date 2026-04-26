import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { userFonts } from "@/lib/db/schema";
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

  const font = await db.query.userFonts.findFirst({
    where: eq(userFonts.id, id),
  });
  if (!font) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (font.userId !== session.userId)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await db.delete(userFonts).where(eq(userFonts.id, id));
  return NextResponse.json({ ok: true });
}
