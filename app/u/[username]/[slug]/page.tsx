import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { users, posts } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { verifySession } from "@/lib/auth";

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

  const post = await db.query.posts.findFirst({
    where: and(eq(posts.authorId, user.id), eq(posts.slug, slug)),
  });
  if (!post) notFound();

  const cookieStore = await cookies();
  const session = await verifySession(cookieStore.get("session")?.value);
  const isOwner = session?.userId === user.id;

  return (
    <article className="mx-auto max-w-3xl">
      <header className="mb-8 border-b border-sky-100 pb-6">
        <div className="mb-3 flex items-center gap-2 text-xs text-slate-500">
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
      <div
        className="article-body"
        dangerouslySetInnerHTML={{ __html: post.content }}
      />
    </article>
  );
}
