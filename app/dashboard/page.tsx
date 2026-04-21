import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { posts } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { verifySession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const session = await verifySession(cookieStore.get("session")?.value);
  if (!session) redirect("/login");

  const rows = await db
    .select()
    .from(posts)
    .where(eq(posts.authorId, session.userId))
    .orderBy(desc(posts.updatedAt));

  return (
    <div>
      <header className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold">내 글 관리</h1>
          <p className="mt-1 text-sm text-zinc-500">
            <Link href={`/u/${session.username}`} className="hover:text-brand">
              내 블로그 보기 →
            </Link>
          </p>
        </div>
        <Link
          href="/write"
          className="rounded-full bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
        >
          + 새 글
        </Link>
      </header>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 p-10 text-center text-zinc-500">
          아직 쓴 글이 없어요.
        </div>
      ) : (
        <ul className="divide-y divide-zinc-100">
          {rows.map((p) => (
            <li key={p.id} className="flex items-center justify-between py-4">
              <Link
                href={`/u/${session.username}/${p.slug}`}
                className="flex-1"
              >
                <div className="flex items-center gap-2 text-xs text-zinc-500">
                  {p.category && <span>{p.category}</span>}
                  <time>{p.updatedAt.toISOString().slice(0, 10)}</time>
                </div>
                <p className="mt-0.5 font-medium hover:text-brand">{p.title}</p>
              </Link>
              <Link
                href={`/edit/${p.id}`}
                className="rounded-full border border-zinc-200 px-3 py-1 text-xs hover:border-brand hover:text-brand"
              >
                수정
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
