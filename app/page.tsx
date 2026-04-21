import Link from "next/link";
import { db } from "@/lib/db";
import { posts, users } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const rows = await db
    .select({
      id: posts.id,
      title: posts.title,
      slug: posts.slug,
      excerpt: posts.excerpt,
      category: posts.category,
      createdAt: posts.createdAt,
      authorUsername: users.username,
      authorDisplayName: users.displayName,
    })
    .from(posts)
    .innerJoin(users, eq(posts.authorId, users.id))
    .where(eq(posts.published, true))
    .orderBy(desc(posts.createdAt))
    .limit(30);

  return (
    <div>
      <section className="mb-10">
        <h1 className="text-3xl font-bold">최신 이야기</h1>
        <p className="mt-2 text-zinc-500">여러 작가의 소설과 에세이</p>
      </section>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 p-10 text-center text-zinc-500">
          아직 작성된 글이 없어요.{" "}
          <Link href="/signup" className="text-brand underline">
            첫 글을 써보세요
          </Link>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {rows.map((p) => (
            <li
              key={p.id}
              className="group rounded-lg border border-zinc-200 p-5 transition hover:border-brand hover:shadow-sm"
            >
              <Link href={`/u/${p.authorUsername}/${p.slug}`} className="block">
                {p.category && (
                  <span className="mb-2 inline-block rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
                    {p.category}
                  </span>
                )}
                <h2 className="text-xl font-bold group-hover:text-brand">
                  {p.title}
                </h2>
                {p.excerpt && (
                  <p className="mt-2 line-clamp-2 text-sm text-zinc-600">
                    {p.excerpt}
                  </p>
                )}
              </Link>
              <div className="mt-3 flex items-center justify-between text-xs text-zinc-500">
                <Link
                  href={`/u/${p.authorUsername}`}
                  className="hover:text-brand"
                >
                  {p.authorDisplayName}
                </Link>
                <time>{formatDate(p.createdAt)}</time>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
