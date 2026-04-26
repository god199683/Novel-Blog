import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { posts } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { verifySession } from "@/lib/auth";

// Diagnostic endpoint. Only accessible to the logged-in user — returns
// their posts with raw slug bytes so we can verify what's actually in
// the database vs what's coming through the URL.
export async function GET() {
  const cookieStore = await cookies();
  const session = await verifySession(cookieStore.get("session")?.value);
  if (!session) {
    return NextResponse.json(
      { error: "로그인이 필요합니다" },
      { status: 401 }
    );
  }

  const rows = await db
    .select({
      id: posts.id,
      slug: posts.slug,
      title: posts.title,
      published: posts.published,
      folderId: posts.folderId,
      createdAt: posts.createdAt,
    })
    .from(posts)
    .where(eq(posts.authorId, session.userId))
    .orderBy(desc(posts.createdAt));

  return NextResponse.json({
    user: { id: session.userId, username: session.username },
    count: rows.length,
    posts: rows.map((p) => ({
      id: p.id,
      title: p.title,
      slug: p.slug,
      slugLen: p.slug.length,
      slugHex: Buffer.from(p.slug, "utf8").toString("hex"),
      slugNFC: p.slug.normalize("NFC"),
      slugNFD: p.slug.normalize("NFD"),
      isNFC: p.slug === p.slug.normalize("NFC"),
      published: p.published,
      folderId: p.folderId,
      // Direct id-based URL that bypasses slug entirely
      idUrl: `/u/${session.username}/${p.id}`,
      slugUrl: `/u/${session.username}/${p.slug}`,
      createdAt: p.createdAt,
    })),
  });
}
