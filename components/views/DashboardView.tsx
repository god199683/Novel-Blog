"use client";

import { useEffect, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import {
  supabase,
  type Post,
  type Folder,
  type Category,
} from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import { descendantIds } from "@/lib/folders";
import BlogSidebar from "@/components/BlogSidebar";

export default function DashboardView() {
  const { user, profile, loading } = useAuth();
  const [params] = useSearchParams();
  const selectedCategory = params.get("category");
  const selectedFolder = params.get("folder");
  const mode: "post" | "material" =
    params.get("kind") === "material" ? "material" : "post";

  const [rows, setRows] = useState<Post[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!user) return;
    let active = true;
    (async () => {
      setLoadingData(true);
      const sb = supabase();

      const [foldersRes, catsRes] = await Promise.all([
        sb
          .from("folders")
          .select("*")
          .eq("user_id", user.id)
          .eq("kind", mode)
          .order("sort_order")
          .order("created_at", { ascending: false }),
        sb
          .from("categories")
          .select("*")
          .eq("user_id", user.id)
          .eq("kind", mode)
          .order("sort_order")
          .order("created_at", { ascending: false }),
      ]);
      if (!active) return;
      const folderRows = (foldersRes.data ?? []) as Folder[];
      setFolders(folderRows);
      setCategories((catsRes.data ?? []) as Category[]);

      let q = sb
        .from("posts")
        .select("*")
        .eq("author_id", user.id)
        .eq("kind", mode)
        .order("updated_at", { ascending: false });
      if (selectedCategory) q = q.eq("category", selectedCategory);
      if (selectedFolder) {
        const ids = descendantIds(folderRows, selectedFolder);
        q = q.in("folder_id", ids);
      }
      const { data: postRows } = await q;
      if (!active) return;
      setRows((postRows ?? []) as Post[]);
      setLoadingData(false);
    })();
    return () => {
      active = false;
    };
  }, [user, selectedCategory, selectedFolder, mode]);

  if (loading) return <p className="py-10 text-center text-slate-500">로딩...</p>;
  if (!user || !profile) return <Navigate to="/login" replace />;

  const folderName = selectedFolder
    ? folders.find((f) => f.id === selectedFolder)?.name
    : null;

  return (
    <div>
      <header className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {mode === "material" ? "내 자료 관리" : "내 글 관리"}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            <Link to={`/u/${profile.username}`} className="hover:text-brand">
              내 블로그 보기 →
            </Link>
          </p>
        </div>
        <Link
          to={mode === "material" ? "/write?kind=material" : "/write"}
          className="rounded-full bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
        >
          + 새 {mode === "material" ? "자료" : "글"}
        </Link>
      </header>

      <nav className="mb-6 flex items-center gap-1 border-b border-sky-100">
        <Link
          to="/dashboard"
          className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${
            mode === "post"
              ? "border-brand text-brand"
              : "border-transparent text-slate-500 hover:text-brand"
          }`}
        >
          글
        </Link>
        <Link
          to="/dashboard?kind=material"
          className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${
            mode === "material"
              ? "border-brand text-brand"
              : "border-transparent text-slate-500 hover:text-brand"
          }`}
        >
          자료
        </Link>
      </nav>

      <div className="grid gap-8 md:grid-cols-[200px_1fr]">
        <BlogSidebar
          username={profile.username}
          isOwner={true}
          mode={mode}
          initialCategories={categories}
          initialFolders={folders}
          selectedCategory={selectedCategory}
          selectedFolder={selectedFolder}
          onChange={(updates) => {
            if (updates.categories) setCategories(updates.categories);
            if (updates.folders) setFolders(updates.folders);
          }}
        />

        <div>
          {(selectedCategory || folderName) && (
            <p className="mb-4 text-sm text-slate-500">
              {selectedCategory && (
                <span className="mr-2">
                  카테고리:{" "}
                  <strong className="text-slate-700">{selectedCategory}</strong>
                </span>
              )}
              {folderName && (
                <span>
                  폴더:{" "}
                  <strong className="text-slate-700">📁 {folderName}</strong>
                </span>
              )}
            </p>
          )}
          {loadingData ? (
            <p className="py-10 text-center text-slate-500">불러오는 중...</p>
          ) : rows.length === 0 ? (
            <div className="rounded-lg border border-dashed border-sky-200 bg-white/60 p-10 text-center text-slate-500">
              {selectedCategory || selectedFolder
                ? "이 분류에 해당하는 글이 없어요."
                : "아직 쓴 글이 없어요."}
            </div>
          ) : (
            <ul className="divide-y divide-sky-100">
              {rows.map((p) => {
                const folder = p.folder_id
                  ? folders.find((f) => f.id === p.folder_id)
                  : null;
                return (
                  <li
                    key={p.id}
                    className="flex items-center justify-between py-4"
                  >
                    <Link
                      to={
                        p.kind === "material"
                          ? `/u/${profile.username}/materials/${p.id}`
                          : `/u/${profile.username}/${p.id}`
                      }
                      className="flex-1"
                    >
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        {p.kind === "material" && (
                          <span className="rounded-full bg-purple-100 px-2 py-0.5 font-medium text-purple-700">
                            자료
                          </span>
                        )}
                        {!p.published && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-700">
                            비공개
                          </span>
                        )}
                        {p.category && (
                          <span className="rounded-full bg-brand-light px-2 py-0.5 text-brand-dark">
                            {p.category}
                          </span>
                        )}
                        {folder && (
                          <span className="rounded-full bg-sky-50 px-2 py-0.5 text-slate-600 ring-1 ring-sky-200">
                            📁 {folder.name}
                          </span>
                        )}
                        <time>{p.updated_at.slice(0, 10)}</time>
                      </div>
                      <p className="mt-0.5 font-medium text-slate-800 hover:text-brand">
                        {p.title}
                      </p>
                    </Link>
                    <Link
                      to={`/edit/${p.id}`}
                      className="rounded-full border border-sky-200 px-3 py-1 text-xs text-slate-700 hover:border-brand hover:text-brand"
                    >
                      수정
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
