"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Item = { id: string; name: string };

type Props = {
  username: string;
  isOwner: boolean;
  initialCategories: Item[];
  initialFolders: Item[];
  selectedCategory: string | null;
  selectedFolder: string | null;
};

export default function BlogSidebar({
  username,
  isOwner,
  initialCategories,
  initialFolders,
  selectedCategory,
  selectedFolder,
}: Props) {
  const router = useRouter();
  const [cats, setCats] = useState<Item[]>(initialCategories);
  const [folders, setFolders] = useState<Item[]>(initialFolders);
  const [newCat, setNewCat] = useState("");
  const [newFolder, setNewFolder] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setCats(initialCategories), [initialCategories]);
  useEffect(() => setFolders(initialFolders), [initialFolders]);

  const buildUrl = (params: { category?: string | null; folder?: string | null }) => {
    const sp = new URLSearchParams();
    const c = params.category !== undefined ? params.category : selectedCategory;
    const f = params.folder !== undefined ? params.folder : selectedFolder;
    if (c) sp.set("category", c);
    if (f) sp.set("folder", f);
    const q = sp.toString();
    return `/u/${username}${q ? `?${q}` : ""}`;
  };

  const refresh = () => router.refresh();

  const addCategory = async () => {
    const name = newCat.trim();
    if (!name) return;
    setError(null);
    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "추가 실패");
      setCats((cs) => [...cs, { id: data.id, name: data.name }]);
      setNewCat("");
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류");
    }
  };

  const renameCategory = async (id: string, oldName: string) => {
    const next = window.prompt("카테고리 새 이름", oldName);
    if (!next || next.trim() === oldName) return;
    setError(null);
    try {
      const res = await fetch(`/api/categories/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: next.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "수정 실패");
      setCats((cs) => cs.map((c) => (c.id === id ? { id, name: data.name } : c)));
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류");
    }
  };

  const deleteCategory = async (id: string, name: string) => {
    if (!confirm(`'${name}' 카테고리를 삭제할까요?`)) return;
    setError(null);
    try {
      const res = await fetch(`/api/categories/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("삭제 실패");
      setCats((cs) => cs.filter((c) => c.id !== id));
      if (selectedCategory === name) router.push(buildUrl({ category: null }));
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류");
    }
  };

  const addFolder = async () => {
    const name = newFolder.trim();
    if (!name) return;
    setError(null);
    try {
      const res = await fetch("/api/folders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "추가 실패");
      setFolders((fs) => [...fs, { id: data.id, name: data.name }]);
      setNewFolder("");
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류");
    }
  };

  const renameFolder = async (id: string, oldName: string) => {
    const next = window.prompt("폴더 새 이름", oldName);
    if (!next || next.trim() === oldName) return;
    setError(null);
    try {
      const res = await fetch(`/api/folders/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: next.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "수정 실패");
      setFolders((fs) => fs.map((f) => (f.id === id ? { id, name: data.name } : f)));
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류");
    }
  };

  const deleteFolder = async (id: string, name: string) => {
    if (!confirm(`'${name}' 폴더를 삭제할까요? (이 폴더의 글들은 폴더 없음으로 이동합니다)`)) return;
    setError(null);
    try {
      const res = await fetch(`/api/folders/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("삭제 실패");
      setFolders((fs) => fs.filter((f) => f.id !== id));
      if (selectedFolder === id) router.push(buildUrl({ folder: null }));
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류");
    }
  };

  return (
    <aside className="space-y-6 text-sm">
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="font-semibold text-slate-700">카테고리</h3>
        </div>
        <ul className="space-y-1">
          <li>
            <Link
              href={buildUrl({ category: null })}
              className={`block rounded px-2 py-1 ${
                !selectedCategory
                  ? "bg-brand-light font-medium text-brand-dark"
                  : "text-slate-600 hover:bg-sky-50"
              }`}
            >
              전체
            </Link>
          </li>
          {cats.map((c) => (
            <li key={c.id} className="group flex items-center gap-1">
              <Link
                href={buildUrl({ category: c.name })}
                className={`flex-1 rounded px-2 py-1 ${
                  selectedCategory === c.name
                    ? "bg-brand-light font-medium text-brand-dark"
                    : "text-slate-600 hover:bg-sky-50"
                }`}
              >
                {c.name}
              </Link>
              {isOwner && (
                <span className="hidden gap-0.5 group-hover:flex">
                  <button
                    type="button"
                    onClick={() => renameCategory(c.id, c.name)}
                    className="rounded px-1 text-xs text-slate-400 hover:text-brand"
                    title="이름 변경"
                  >
                    ✎
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteCategory(c.id, c.name)}
                    className="rounded px-1 text-xs text-slate-400 hover:text-red-500"
                    title="삭제"
                  >
                    ✕
                  </button>
                </span>
              )}
            </li>
          ))}
        </ul>
        {isOwner && (
          <div className="mt-2 flex gap-1">
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
              placeholder="새 카테고리"
              maxLength={30}
              className="flex-1 rounded border border-sky-200 bg-white px-2 py-1 text-xs text-slate-700 outline-none focus:border-brand"
            />
            <button
              type="button"
              onClick={addCategory}
              className="rounded border border-sky-200 px-2 py-1 text-xs text-slate-600 hover:border-brand hover:text-brand"
            >
              +
            </button>
          </div>
        )}
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="font-semibold text-slate-700">폴더</h3>
        </div>
        <ul className="space-y-1">
          <li>
            <Link
              href={buildUrl({ folder: null })}
              className={`block rounded px-2 py-1 ${
                !selectedFolder
                  ? "bg-brand-light font-medium text-brand-dark"
                  : "text-slate-600 hover:bg-sky-50"
              }`}
            >
              전체
            </Link>
          </li>
          {folders.map((f) => (
            <li key={f.id} className="group flex items-center gap-1">
              <Link
                href={buildUrl({ folder: f.id })}
                className={`flex-1 rounded px-2 py-1 ${
                  selectedFolder === f.id
                    ? "bg-brand-light font-medium text-brand-dark"
                    : "text-slate-600 hover:bg-sky-50"
                }`}
              >
                📁 {f.name}
              </Link>
              {isOwner && (
                <span className="hidden gap-0.5 group-hover:flex">
                  <button
                    type="button"
                    onClick={() => renameFolder(f.id, f.name)}
                    className="rounded px-1 text-xs text-slate-400 hover:text-brand"
                    title="이름 변경"
                  >
                    ✎
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteFolder(f.id, f.name)}
                    className="rounded px-1 text-xs text-slate-400 hover:text-red-500"
                    title="삭제"
                  >
                    ✕
                  </button>
                </span>
              )}
            </li>
          ))}
        </ul>
        {isOwner && (
          <div className="mt-2 flex gap-1">
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
              placeholder="새 폴더"
              maxLength={30}
              className="flex-1 rounded border border-sky-200 bg-white px-2 py-1 text-xs text-slate-700 outline-none focus:border-brand"
            />
            <button
              type="button"
              onClick={addFolder}
              className="rounded border border-sky-200 px-2 py-1 text-xs text-slate-600 hover:border-brand hover:text-brand"
            >
              +
            </button>
          </div>
        )}
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}
    </aside>
  );
}
