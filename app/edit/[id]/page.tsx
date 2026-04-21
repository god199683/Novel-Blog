import { notFound, redirect } from "next/navigation";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { posts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { verifySession } from "@/lib/auth";
import PostForm from "@/components/PostForm";

export default async function EditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const cookieStore = await cookies();
  const session = await verifySession(cookieStore.get("session")?.value);
  if (!session) redirect("/login");

  const post = await db.query.posts.findFirst({ where: eq(posts.id, id) });
  if (!post) notFound();
  if (post.authorId !== session.userId) redirect("/");

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">글 수정</h1>
      <PostForm
        initial={{
          id: post.id,
          title: post.title,
          content: post.content,
          category: post.category,
        }}
      />
    </div>
  );
}
