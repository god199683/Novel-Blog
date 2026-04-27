"use client";

import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase, type Category, type Folder } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";

type Props = {
  username: string;
  isOwner: boolean;
  initialCategories: Category[];
  initialFolders: Folder[];
  selectedCategory: string | null;
  selectedFolder: string | null;
  onChange: (updates: {
    categories?: Category[];
    folders?: Folder[];
  }) => void;
};

export default function BlogSidebar({
  username,
  isOwner,
  initialCategories,
  initialFolders,
  selectedCategory,
  selectedFolder,
  onChange,
}: Props) {
  const { user } = useAuth();
  const [cats, setCats] = useState(initialCategories);
  const [fls, setFls] = useState(initialFolders);
  const [newCat, setNewCat] = useState("");
  const [newFolder, setNewFolder] = useState("");

  const addCategory = async () => {
    const name = newCat.trim();
    if (!name || !user) return;
    const { data, error } = await supabase()
      .from("categories")
      .insert({ user_id: user.id, name, sort_order: cats.length })
      .select()
      .single();
    if (error) {
      alert(error.message);
      return;
    }
    const updated = [...cats, data as Category];
    setCats(updated);
    setNewCat("");
    onChange({ categories: updated });
  };

  const deleteCategory = async (id: string, name: string) => {
    if (!confirm(`'${name}' 카테고리를 삭제할까요?`)) return;
    const { error } = await supabase().from("categories").delete().eq("id", id);
    if (error) {
      alert(error.message);
      return;
    }
    const updated = cats.filter((c) => c.id !== id);
    setCats(updated);
    onChange({ categories: updated });
  };

  const addFolder = async () => {
    const name = newFolder.trim();
    if (!name || !user) return;
    const { data, error } = await supabase()
      .from("folders")
      .insert({ user_id: user.id, name, sort_order: fls.length })
      .select()
      .single();
    if (error) {
      alert(error.message);
      return;
    }
    const updated = [...fls, data as Folder];
    setFls(updated);
    setNewFolder("");
    onChange({ folders: updated });
  };

  const deleteFolder = async (id: string, name: string) => {
    if (!confirm(`'${name}' 폴더를 삭제할까요? (글은 폴더 없음으로 이동)`)) return;
    const { error } = await supabase().from("folders").delete().eq("id", id);
    if (error) {
      alert(error.message);
      return;
    }
    const updated = fls.filter((f) => f.id !== id);
    setFls(updated);
    onChange({ folders: updated });
  };

  return (
    <aside className="space-y-6 text-sm">
      <div>
        <h3 className="mb-2 font-semibold text-slate-700">카테고리</h3>
        <ul className="space-y-1">
          <li>
            <Link
              to={`/u/${username}`}
              className={`block rounded px-2 py-1 ${
                !selectedCategory && !selectedFolder
                  ? "bg-brand-light font-medium text-brand-dark"
                  : "text-slate-600 hover:bg-sky-50"
              }`}
            >
              전체 글
            </Link>
          </li>
          {cats.map((c) => (
            <li key={c.id} className="group flex items-center justify-between">
              <Link
                to={`/u/${username}?category=${encodeURIComponent(c.name)}`}
                className={`block flex-1 rounded px-2 py-1 ${
                  selectedCategory === c.name
                    ? "bg-brand-light font-medium text-brand-dark"
                    : "text-slate-600 hover:bg-sky-50"
                }`}
              >
                {c.name}
              </Link>
              {isOwner && (
                <button
                  type="button"
                  onClick={() => deleteCategory(c.id, c.name)}
                  className="hidden rounded px-1 text-xs text-slate-400 hover:text-red-500 group-hover:block"
                >
                  ✕
                </button>
              )}
            </li>
          ))}
        </ul>
        {isOwner && (
          <div className="mt-2 flex items-center gap-1">
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
              className="w-full rounded border border-sky-200 bg-white px-2 py-1 text-xs text-slate-700 focus:border-brand focus:outline-none"
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
        <h3 className="mb-2 font-semibold text-slate-700">폴더</h3>
        <ul className="space-y-1">
          {fls.map((f) => (
            <li key={f.id} className="group flex items-center justify-between">
              <Link
                to={`/u/${username}?folder=${f.id}`}
                className={`block flex-1 rounded px-2 py-1 ${
                  selectedFolder === f.id
                    ? "bg-brand-light font-medium text-brand-dark"
                    : "text-slate-600 hover:bg-sky-50"
                }`}
              >
                📁 {f.name}
              </Link>
              {isOwner && (
                <button
                  type="button"
                  onClick={() => deleteFolder(f.id, f.name)}
                  className="hidden rounded px-1 text-xs text-slate-400 hover:text-red-500 group-hover:block"
                >
                  ✕
                </button>
              )}
            </li>
          ))}
        </ul>
        {isOwner && (
          <div className="mt-2 flex items-center gap-1">
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
              className="w-full rounded border border-sky-200 bg-white px-2 py-1 text-xs text-slate-700 focus:border-brand focus:outline-none"
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
    </aside>
  );
}
