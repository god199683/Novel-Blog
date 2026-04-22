import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { users, posts } from "@/lib/db/schema";
import { desc, eq, and } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function UserBlogPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const user = await db.query.users.findFirst({
    where: eq(users.username, username.toLowerCase()),
  });
  if (!user) notFound();

  const rows = await db
    .select()
    .from(posts)
    .where(and(eq(posts.authorId, user.id), eq(posts.published, true)))
    .orderBy(desc(posts.createdAt));

  return (
    <div>
      <section className="mb-8 rounded-2xl bg-gradient-to-br from-sky-50 to-white p-8 ring-1 ring-sky-100">
        <h1 className="text-3xl font-bold text-slate-900">{user.blogTitle ?? `${user.displayName}의 블로그`}</h1>
        <p className="mt-1 text-sm text-slate-500">@{user.username} · {user.displayName}</p>
        {user.bio && <p className="mt-3 text-slate-700">{user.bio}</p>}
      </section>

      {rows.length === 0 ? (
        <p className="py-10 text-center text-slate-500">아직 글이 없어요.</p>
      ) : (
        <ul className="divide-y divide-sky-100">
          {rows.map((p) => (
            <li key={p.id} className="py-5">
              <Link
                href={`/u/${user.username}/${p.slug}`}
                className="block group"
              >
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  {p.category && (
                    <span className="rounded-full bg-brand-light px-2 py-0.5 text-brand-dark">
                      {p.category}
                    </span>
                  )}
                  <time>{p.createdAt.toISOString().slice(0, 10)}</time>
                </div>
                <h2 className="mt-1 text-xl font-bold text-slate-900 group-hover:text-brand">
                  {p.title}
                </h2>
                {p.excerpt && (
                  <p className="mt-1 line-clamp-2 text-sm text-slate-600">
                    {p.excerpt}
                  </p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
