"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  postId: string;
  title: string;
  published: boolean;
};

export default function PostActions({ postId, title, published }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const remove = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`'${title}' 글을 정말 삭제할까요?`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/posts/${postId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("삭제 실패");
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "오류");
      setBusy(false);
    }
  };

  const toggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (published) {
      if (!confirm(`'${title}' 글을 비공개로 전환할까요? (다른 사람은 볼 수 없게 됩니다)`))
        return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/posts/${postId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ published: !published }),
      });
      if (!res.ok) throw new Error("변경 실패");
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "오류");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex shrink-0 items-center gap-1">
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        title={
          published
            ? "현재 공개됨 — 클릭하면 비공개로 전환"
            : "현재 비공개 — 클릭하면 공개로 전환"
        }
        className={`rounded-full border px-2 py-1 text-xs disabled:opacity-50 ${
          published
            ? "border-sky-200 text-slate-600 hover:border-brand hover:text-brand"
            : "border-amber-200 bg-amber-50 text-amber-700 hover:border-amber-400"
        }`}
      >
        {published ? "🌐 공개" : "🔒 비공개"}
      </button>
      <Link
        href={`/edit/${postId}`}
        onClick={(e) => e.stopPropagation()}
        className="rounded-full border border-sky-200 px-2 py-1 text-xs text-slate-700 hover:border-brand hover:text-brand"
      >
        수정
      </Link>
      <button
        type="button"
        onClick={remove}
        disabled={busy}
        className="rounded-full border border-sky-200 px-2 py-1 text-xs text-slate-600 hover:border-red-300 hover:text-red-600 disabled:opacity-50"
      >
        삭제
      </button>
    </div>
  );
}
