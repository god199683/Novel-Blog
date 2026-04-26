import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { users, posts } from "@/lib/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { verifySession } from "@/lib/auth";
import ArticleViewer from "@/components/ArticleViewer";

export const dynamic = "force-dynamic";

export default async function PostPage({
  params,
}: {
  params: Promise<{ username: string; slug: string }>;
}) {
  const { username, slug } = await params;
  const user = await db.query.users.findFirst({
    where: eq(users.username, username.toLowerCase()),
  });
  if (!user) notFound();

  // Try multiple lookup strategies because URL/DB Hangul normalization
  // (NFC vs NFD) can disagree — the IME may store decomposed jamo while
  // the URL gets canonicalized to NFC by the browser/CDN, or vice versa.
  const candidates = Array.from(
    new Set([slug, slug.normalize("NFC"), slug.normalize("NFD")])
  );
  let post: typeof posts.$inferSelect | undefined;
  for (const s of candidates) {
    post = await db.query.posts.findFirst({
      where: and(eq(posts.authorId, user.id), eq(posts.slug, s)),
    });
    if (post) break;
  }
  if (!post) {
    // Final fallback: treat slug as a post id (for legacy or odd cases)
    post = await db.query.posts.findFirst({
      where: and(eq(posts.authorId, user.id), eq(posts.id, slug)),
    });
  }
  if (!post) {
    // Helps diagnose 404s in production logs (Netlify function logs).
    console.warn(
      "[post-lookup] not-found username=%s slugLen=%d slugHex=%s",
      username,
      slug.length,
      Buffer.from(slug, "utf8").toString("hex")
    );
    notFound();
  }

  const cookieStore = await cookies();
  const session = await verifySession(cookieStore.get("session")?.value);
  const isOwner = session?.userId === user.id;

  // Surface a clear message rather than a generic 404 when the post
  // exists but is private — this also tells us the cookie/session
  // round-trip is working when the owner sees their own private post.
  if (!post.published && !isOwner) {
    return (
      <div className="mx-auto max-w-md py-20 text-center">
        <h1 className="text-xl font-bold text-slate-900">비공개 글이에요</h1>
        <p className="mt-2 text-sm text-slate-500">
          이 글은 작성자만 볼 수 있어요.
        </p>
        <Link
          href={`/u/${user.username}`}
          className="mt-6 inline-block text-sm text-brand hover:underline"
        >
          {user.displayName}님의 블로그로 →
        </Link>
      </div>
    );
  }

  // Find prev/next post within the same folder for book-mode
  // navigation. Reading order = oldest → newest (chronological,
  // matches how serialized novels are written chapter by chapter).
  let prevSibling: { id: string; title: string } | null = null;
  let nextSibling: { id: string; title: string } | null = null;
  if (post.folderId) {
    const sibConds = [
      eq(posts.authorId, user.id),
      eq(posts.folderId, post.folderId),
    ];
    if (!isOwner) sibConds.push(eq(posts.published, true));
    const siblings = await db
      .select({ id: posts.id, title: posts.title })
      .from(posts)
      .where(and(...sibConds))
      .orderBy(asc(posts.createdAt));
    const idx = siblings.findIndex((s) => s.id === post.id);
    if (idx > 0) prevSibling = siblings[idx - 1];
    if (idx >= 0 && idx < siblings.length - 1)
      nextSibling = siblings[idx + 1];
  }

  return (
    <article className="mx-auto max-w-3xl">
      <header className="mb-8 border-b border-sky-100 pb-6">
        <div className="mb-3 flex items-center gap-2 text-xs text-slate-500">
          {!post.published && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-700">
              비공개
            </span>
          )}
          {post.category && (
            <span className="rounded-full bg-brand-light px-2 py-0.5 text-brand-dark">
              {post.category}
            </span>
          )}
          <time>{post.createdAt.toISOString().slice(0, 10)}</time>
          {post.updatedAt.getTime() - post.createdAt.getTime() > 60000 && (
            <span className="text-slate-400">
              (수정 {post.updatedAt.toISOString().slice(0, 10)})
            </span>
          )}
        </div>
        <h1 className="text-3xl font-bold leading-snug text-slate-900">{post.title}</h1>
        <div className="mt-4 flex items-center justify-between">
          <Link
            href={`/u/${user.username}`}
            className="text-sm text-slate-700 hover:text-brand"
          >
            {user.displayName} <span className="text-slate-400">@{user.username}</span>
          </Link>
          {isOwner && (
            <Link
              href={`/edit/${post.id}`}
              className="rounded-full border border-sky-200 px-3 py-1 text-xs text-slate-700 hover:border-brand hover:text-brand"
            >
              수정
            </Link>
          )}
        </div>
      </header>
      <ArticleViewer
        key={post.id}
        html={post.content}
        title={post.title}
        authorName={user.displayName}
        prevHref={
          prevSibling ? `/u/${user.username}/${prevSibling.id}` : null
        }
        prevTitle={prevSibling?.title ?? null}
        nextHref={
          nextSibling ? `/u/${user.username}/${nextSibling.id}` : null
        }
        nextTitle={nextSibling?.title ?? null}
      />
    </article>
  );
}
