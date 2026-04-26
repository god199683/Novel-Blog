import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { users, posts, categories, folders } from "@/lib/db/schema";
import { desc, eq, and, asc } from "drizzle-orm";
import { verifySession } from "@/lib/auth";
import BlogSidebar from "@/components/BlogSidebar";
import PostActions from "@/components/PostActions";

export const dynamic = "force-dynamic";

export default async function UserBlogPage({
  params,
  searchParams,
}: {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ category?: string; folder?: string }>;
}) {
  const { username } = await params;
  const sp = await searchParams;
  const selectedCategory = sp.category ?? null;
  const selectedFolder = sp.folder ?? null;

  const user = await db.query.users.findFirst({
    where: eq(users.username, username.toLowerCase()),
  });
  if (!user) notFound();

  const cookieStore = await cookies();
  const session = await verifySession(cookieStore.get("session")?.value);
  const isOwner = session?.userId === user.id;

  const [cats, fls] = await Promise.all([
    db
      .select({ id: categories.id, name: categories.name })
      .from(categories)
      .where(eq(categories.userId, user.id))
      .orderBy(asc(categories.sortOrder), desc(categories.createdAt)),
    db
      .select({ id: folders.id, name: folders.name })
      .from(folders)
      .where(eq(folders.userId, user.id))
      .orderBy(asc(folders.sortOrder), desc(folders.createdAt)),
  ]);

  const conditions = [eq(posts.authorId, user.id)];
  if (!isOwner) conditions.push(eq(posts.published, true));
  if (selectedCategory) conditions.push(eq(posts.category, selectedCategory));
  if (selectedFolder) conditions.push(eq(posts.folderId, selectedFolder));

  const rows = await db
    .select()
    .from(posts)
    .where(and(...conditions))
    .orderBy(desc(posts.createdAt));

  const folderName = selectedFolder
    ? fls.find((f) => f.id === selectedFolder)?.name
    : null;

  return (
    <div>
      <section className="mb-8 rounded-2xl bg-gradient-to-br from-sky-50 to-white p-8 ring-1 ring-sky-100">
        <h1 className="text-3xl font-bold text-slate-900">
          {user.blogTitle ?? `${user.displayName}의 블로그`}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          @{user.username} · {user.displayName}
        </p>
        {user.bio && <p className="mt-3 text-slate-700">{user.bio}</p>}
      </section>

      <div className="grid gap-8 md:grid-cols-[200px_1fr]">
        <BlogSidebar
          username={user.username}
          isOwner={isOwner}
          initialCategories={cats}
          initialFolders={fls}
          selectedCategory={selectedCategory}
          selectedFolder={selectedFolder}
        />

        <div>
          {(selectedCategory || folderName) && (
            <p className="mb-4 text-sm text-slate-500">
              {selectedCategory && (
                <span className="mr-2">
                  카테고리: <strong className="text-slate-700">{selectedCategory}</strong>
                </span>
              )}
              {folderName && (
                <span>
                  폴더: <strong className="text-slate-700">📁 {folderName}</strong>
                </span>
              )}
            </p>
          )}
          {rows.length === 0 ? (
            <p className="py-10 text-center text-slate-500">아직 글이 없어요.</p>
          ) : (
            <ul className="divide-y divide-sky-100">
              {rows.map((p) => {
                const folder = p.folderId ? fls.find((f) => f.id === p.folderId) : null;
                return (
                  <li key={p.id} className="flex items-start justify-between gap-4 py-5">
                    <Link
                      href={`/u/${user.username}/${p.id}`}
                      className="block flex-1 group"
                    >
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        {!p.published && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-700">
                            비공개
                          </span>
                        )}
                        {p.category && (
                          <span className="rounded-full bg-brand-light px-2 py-0.5 text-brand-dark">
                            {p.category}
                          </span>
                        )}
                        {folder && (
                          <span className="rounded-full bg-sky-50 px-2 py-0.5 text-slate-600 ring-1 ring-sky-200">
                            📁 {folder.name}
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
                    {isOwner && (
                      <PostActions
                        postId={p.id}
                        title={p.title}
                        published={p.published}
                      />
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
