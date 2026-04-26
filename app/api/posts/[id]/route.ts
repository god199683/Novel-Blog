import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { posts } from "@/lib/db/schema";
import { verifySession } from "@/lib/auth";
import { eq } from "drizzle-orm";

function excerptFromHtml(html: string, n = 160): string {
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return text.length > n ? text.slice(0, n) + "…" : text;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const cookieStore = await cookies();
  const session = await verifySession(cookieStore.get("session")?.value);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const post = await db.query.posts.findFirst({ where: eq(posts.id, id) });
  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (post.authorId !== session.userId)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const title = String(body.title ?? "").trim() || post.title;
  const content = String(body.content ?? post.content);
  const category =
    body.category === null || body.category === ""
      ? null
      : String(body.category);
  const folderId =
    body.folderId === undefined
      ? post.folderId
      : body.folderId === null || body.folderId === ""
      ? null
      : String(body.folderId);
  const published =
    body.published === undefined ? post.published : Boolean(body.published);

  await db
    .update(posts)
    .set({
      title,
      content,
      excerpt: excerptFromHtml(content),
      category,
      folderId,
      published,
      updatedAt: new Date(),
    })
    .where(eq(posts.id, id));

  return NextResponse.json({
    id: post.id,
    slug: post.slug,
    authorUsername: session.username,
  });
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

  const post = await db.query.posts.findFirst({ where: eq(posts.id, id) });
  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (post.authorId !== session.userId)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await db.delete(posts).where(eq(posts.id, id));
  return NextResponse.json({ ok: true });
}
