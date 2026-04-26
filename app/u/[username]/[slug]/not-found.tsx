import Link from "next/link";

export default function PostNotFound() {
  return (
    <div className="mx-auto max-w-md py-20 text-center">
      <h1 className="text-2xl font-bold text-slate-900">글을 찾을 수 없어요</h1>
      <p className="mt-3 text-sm text-slate-500">
        URL이 바뀌었거나 글이 삭제되었을 수 있어요. 블로그 목록에서 다시
        찾아보세요.
      </p>
      <div className="mt-6 flex flex-col items-center gap-2">
        <Link
          href="/"
          className="rounded-full bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
        >
          홈으로
        </Link>
        <Link
          href="/dashboard"
          className="text-xs text-slate-500 hover:text-brand"
        >
          내 글 관리로 가기
        </Link>
      </div>
    </div>
  );
}
