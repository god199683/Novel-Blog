"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Editor from "./Editor";

type Props = {
  initial?: {
    id?: string;
    title: string;
    content: string;
    category: string | null;
  };
};

const CATEGORIES = ["장편", "단편", "에세이", "기타"];

export default function PostForm({ initial }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [content, setContent] = useState(initial?.content ?? "");
  const [category, setCategory] = useState(initial?.category ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!title.trim()) {
      setError("제목을 입력해 주세요");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const url = initial?.id ? `/api/posts/${initial.id}` : "/api/posts";
      const method = initial?.id ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, content, category: category || null }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "저장 실패");
      }
      const data = await res.json();
      router.push(`/u/${data.authorUsername}/${data.slug}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!initial?.id) return;
    if (!confirm("정말 삭제하시겠습니까?")) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/posts/${initial.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("삭제 실패");
      router.push("/dashboard");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류");
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="제목"
        className="w-full border-b-2 border-sky-200 bg-transparent py-3 text-2xl font-bold text-slate-900 outline-none focus:border-brand"
      />
      <div className="flex items-center gap-2">
        <label className="text-sm text-slate-500">카테고리</label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded border border-sky-200 bg-white px-2 py-1 text-sm text-slate-700"
        >
          <option value="">선택 안 함</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
      <Editor initialContent={content} onChange={setContent} />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex items-center justify-end gap-2 pt-2">
        {initial?.id && (
          <button
            type="button"
            onClick={remove}
            disabled={saving}
            className="rounded px-4 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            삭제
          </button>
        )}
        <button
          type="button"
          onClick={submit}
          disabled={saving}
          className="rounded-full bg-brand px-6 py-2 font-medium text-white hover:bg-brand-dark disabled:opacity-50"
        >
          {saving ? "저장 중..." : initial?.id ? "수정" : "발행"}
        </button>
      </div>
    </div>
  );
}
