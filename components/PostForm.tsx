"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Editor from "./Editor";

type Props = {
  initial?: {
    id?: string;
    title: string;
    content: string;
    category: string | null;
    folderId?: string | null;
  };
};

export default function PostForm({ initial }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [content, setContent] = useState(initial?.content ?? "");
  const [category, setCategory] = useState(initial?.category ?? "");
  const [folderId, setFolderId] = useState<string>(initial?.folderId ?? "");
  const [cats, setCats] = useState<{ id: string; name: string }[]>([]);
  const [folders, setFolders] = useState<{ id: string; name: string }[]>([]);
  const [newCat, setNewCat] = useState("");
  const [newFolder, setNewFolder] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/categories")
      .then((r) => r.json())
      .then((d) => Array.isArray(d) && setCats(d));
    fetch("/api/folders")
      .then((r) => r.json())
      .then((d) => Array.isArray(d) && setFolders(d));
  }, []);

  const addCategory = async () => {
    const name = newCat.trim();
    if (!name) return;
    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "추가 실패");
      setCats((cs) => [...cs, { id: data.id, name: data.name }]);
      setCategory(data.name);
      setNewCat("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류");
    }
  };

  const deleteCategory = async (id: string, name: string) => {
    if (!confirm(`'${name}' 카테고리를 삭제할까요? (기존 글의 카테고리 태그는 남습니다)`)) return;
    try {
      const res = await fetch(`/api/categories/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("삭제 실패");
      setCats((cs) => cs.filter((c) => c.id !== id));
      if (category === name) setCategory("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류");
    }
  };

  const addFolder = async () => {
    const name = newFolder.trim();
    if (!name) return;
    try {
      const res = await fetch("/api/folders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "추가 실패");
      setFolders((fs) => [...fs, { id: data.id, name: data.name }]);
      setFolderId(data.id);
      setNewFolder("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류");
    }
  };

  const deleteFolder = async (id: string, name: string) => {
    if (!confirm(`'${name}' 폴더를 삭제할까요? (이 폴더의 글들은 폴더 없음으로 이동합니다)`)) return;
    try {
      const res = await fetch(`/api/folders/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("삭제 실패");
      setFolders((fs) => fs.filter((f) => f.id !== id));
      if (folderId === id) setFolderId("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류");
    }
  };

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
        body: JSON.stringify({
          title,
          content,
          category: category || null,
          folderId: folderId || null,
        }),
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
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-sm text-slate-500">카테고리</label>
          <button
            type="button"
            onClick={() => setCategory("")}
            className={`rounded-full px-3 py-1 text-xs ${
              category === ""
                ? "bg-brand text-white"
                : "border border-sky-200 text-slate-600 hover:border-brand"
            }`}
          >
            선택 안 함
          </button>
          {cats.map((c) => (
            <span
              key={c.id}
              className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs ${
                category === c.name
                  ? "bg-brand text-white"
                  : "border border-sky-200 text-slate-700 hover:border-brand"
              }`}
            >
              <button type="button" onClick={() => setCategory(c.name)}>
                {c.name}
              </button>
              <button
                type="button"
                onClick={() => deleteCategory(c.id, c.name)}
                className={`ml-1 text-[10px] ${
                  category === c.name ? "text-white/80 hover:text-white" : "text-slate-400 hover:text-red-500"
                }`}
                title="삭제"
              >
                ✕
              </button>
            </span>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newCat}
            onChange={(e) => setNewCat(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addCategory();
              }
            }}
            placeholder="새 카테고리 이름"
            maxLength={30}
            className="rounded border border-sky-200 bg-white px-2 py-1 text-sm text-slate-700 outline-none focus:border-brand"
          />
          <button
            type="button"
            onClick={addCategory}
            className="rounded-full border border-sky-200 px-3 py-1 text-xs text-slate-700 hover:border-brand hover:text-brand"
          >
            + 추가
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-sm text-slate-500">폴더</label>
          <button
            type="button"
            onClick={() => setFolderId("")}
            className={`rounded-full px-3 py-1 text-xs ${
              folderId === ""
                ? "bg-brand text-white"
                : "border border-sky-200 text-slate-600 hover:border-brand"
            }`}
          >
            폴더 없음
          </button>
          {folders.map((f) => (
            <span
              key={f.id}
              className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs ${
                folderId === f.id
                  ? "bg-brand text-white"
                  : "border border-sky-200 text-slate-700 hover:border-brand"
              }`}
            >
              <button type="button" onClick={() => setFolderId(f.id)}>
                📁 {f.name}
              </button>
              <button
                type="button"
                onClick={() => deleteFolder(f.id, f.name)}
                className={`ml-1 text-[10px] ${
                  folderId === f.id ? "text-white/80 hover:text-white" : "text-slate-400 hover:text-red-500"
                }`}
                title="삭제"
              >
                ✕
              </button>
            </span>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newFolder}
            onChange={(e) => setNewFolder(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addFolder();
              }
            }}
            placeholder="새 폴더 이름"
            maxLength={30}
            className="rounded border border-sky-200 bg-white px-2 py-1 text-sm text-slate-700 outline-none focus:border-brand"
          />
          <button
            type="button"
            onClick={addFolder}
            className="rounded-full border border-sky-200 px-3 py-1 text-xs text-slate-700 hover:border-brand hover:text-brand"
          >
            + 추가
          </button>
        </div>
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
