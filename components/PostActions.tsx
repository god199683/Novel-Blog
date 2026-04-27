"use client";

import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";

type Props = {
  postId: string;
  title: string;
  published: boolean;
  onChanged?: (action: "deleted" | "toggled") => void;
};

export default function PostActions({ postId, title, published, onChanged }: Props) {
  const [busy, setBusy] = useState(false);

  const remove = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`'${title}' 글을 정말 삭제할까요?`)) return;
    setBusy(true);
    const { error } = await supabase().from("posts").delete().eq("id", postId);
    setBusy(false);
    if (error) {
      alert(error.message);
      return;
    }
    onChanged?.("deleted");
  };

  const toggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (published) {
      if (!confirm(`'${title}' 글을 비공개로 전환할까요?`)) return;
    }
    setBusy(true);
    const { error } = await supabase()
      .from("posts")
      .update({ published: !published })
      .eq("id", postId);
    setBusy(false);
    if (error) {
      alert(error.message);
      return;
    }
    onChanged?.("toggled");
  };

  return (
    <div className="flex shrink-0 items-center gap-1">
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        title={
          published
            ? "현재 공개됨 — 클릭하면 비공개"
            : "현재 비공개 — 클릭하면 공개"
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
        to={`/edit/${postId}`}
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
