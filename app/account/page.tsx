import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySession } from "@/lib/auth";
import { db } from "@/lib/db";
import { posts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { count } from "drizzle-orm";
import DeleteAccountForm from "@/components/DeleteAccountForm";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const cookieStore = await cookies();
  const session = await verifySession(cookieStore.get("session")?.value);
  if (!session) redirect("/login");

  const [{ value: postCount } = { value: 0 }] = await db
    .select({ value: count() })
    .from(posts)
    .where(eq(posts.authorId, session.userId));

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="mb-6 text-2xl font-bold text-slate-900">계정 설정</h1>

      <section className="mb-6 rounded-lg border border-sky-100 bg-white/70 p-5">
        <h2 className="mb-2 text-sm font-semibold text-slate-700">계정 정보</h2>
        <dl className="space-y-1 text-sm text-slate-600">
          <div className="flex gap-2">
            <dt className="w-24 text-slate-400">이름</dt>
            <dd>{session.displayName}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-24 text-slate-400">아이디</dt>
            <dd>@{session.username}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-24 text-slate-400">작성한 글</dt>
            <dd>{postCount}개</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-lg border border-red-200 bg-red-50/50 p-5">
        <h2 className="mb-1 text-sm font-semibold text-red-700">위험 구역</h2>
        <p className="mb-4 text-xs text-red-600/80">
          계정을 삭제하면 작성한 모든 글({postCount}개), 폴더, 카테고리,
          폰트 설정이 영구적으로 사라집니다. 이 작업은 되돌릴 수 없습니다.
        </p>
        <DeleteAccountForm postCount={postCount} />
      </section>
    </div>
  );
}
