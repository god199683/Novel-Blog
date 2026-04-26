import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { posts, users } from "@/lib/db/schema";
import { verifySession } from "@/lib/auth";
import { makeId, slugify, withSuffix } from "@/lib/slug";
import { eq, and } from "drizzle-orm";

function excerptFromHtml(html: string, n = 160): string {
  const text = html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > n ? text.slice(0, n) + "…" : text;
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const session = await verifySession(cookieStore.get("session")?.value);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const title = String(body.title ?? "").trim();
  const content = String(body.content ?? "");
  const category =
    body.category === null || body.category === ""
      ? null
      : String(body.category);
  const folderId =
    body.folderId === null || body.folderId === "" || body.folderId === undefined
      ? null
      : String(body.folderId);
  const published = body.published === undefined ? true : Boolean(body.published);

  if (!title) return NextResponse.json({ error: "제목을 입력해 주세요" }, { status: 400 });

  let slug = slugify(title);
  const existing = await db.query.posts.findFirst({
    where: and(eq(posts.authorId, session.userId), eq(posts.slug, slug)),
  });
  if (existing) slug = withSuffix(slug);

  const id = makeId();
  const now = new Date();
  await db.insert(posts).values({
    id,
    authorId: session.userId,
    slug,
    title,
    content,
    excerpt: excerptFromHtml(content),
    category,
    folderId,
    published,
    createdAt: now,
    updatedAt: now,
  });

  return NextResponse.json({ id, slug, authorUsername: session.username });
}
