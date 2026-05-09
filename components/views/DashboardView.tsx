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
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);

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

      // 사이드바에 전체 트리가 보여야 하므로 필터 없이 모든 글을 가져옴.
      // 본문 ContentTree가 selectedCategory/selectedFolder로 좁힘.
      const { data: postRows } = await sb
        .from("posts")
        .select("*")
        .eq("author_id", user.id)
        .eq("kind", mode)
        .order("updated_at", { ascending: false });
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

  const togglePick = (id: string) => {
    setPicked((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const exportPostAsHtml = (p: Post) => {
    const html = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<title>${escapeHtml(p.title)}</title>
<style>
  body { font-family: 'Pretendard', system-ui, sans-serif; max-width: 720px; margin: 2em auto; padding: 0 1em; line-height: 1.85; color: #0f172a; }
  h1 { border-bottom: 2px solid #c7ddf5; padding-bottom: .5em; margin-bottom: 1em; }
  .meta { color: #64748b; font-size: 13px; margin-bottom: 2em; }
  img { max-width: 100%; height: auto; border-radius: 6px; }
  blockquote { border-left: 3px solid #c7ddf5; padding-left: 1em; color: #475569; font-style: italic; }
  pre { background: #f1f5f9; padding: 1em; border-radius: 6px; overflow-x: auto; }
  code { background: #f1f5f9; padding: 0.1em 0.3em; border-radius: 3px; font-size: 0.9em; }
</style>
</head>
<body>
<h1>${escapeHtml(p.title)}</h1>
<p class="meta">${p.kind === "material" ? "자료 · " : ""}${p.created_at.slice(0, 10)}${
      p.category ? ` · ${escapeHtml(p.category)}` : ""
    }</p>
${p.content || ""}
</body>
</html>`;
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${sanitizeFilename(p.title || "글")}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const exportPicked = async () => {
    if (picked.size === 0) return;
    setExporting(true);
    try {
      const list = rows.filter((p) => picked.has(p.id));
      for (const p of list) {
        exportPostAsHtml(p);
        // 브라우저 동시 다운로드 차단 회피
        await new Promise((r) => setTimeout(r, 250));
      }
    } finally {
      setExporting(false);
    }
  };

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
        <div className="flex gap-2">
          {picked.size > 0 && (
            <>
              <button
                type="button"
                onClick={exportPicked}
                disabled={exporting}
                className="rounded-full bg-brand-light px-3 py-2 text-sm font-medium text-brand-dark hover:opacity-90 disabled:opacity-60"
              >
                {exporting
                  ? "내보내는 중..."
                  : `📥 선택 ${picked.size}편 내보내기`}
              </button>
              <button
                type="button"
                onClick={() => setPicked(new Set())}
                className="rounded-full border border-sky-200 px-3 py-2 text-sm text-slate-600 hover:border-brand"
              >
                선택 해제
              </button>
            </>
          )}
          <Link
            to={mode === "material" ? "/write?kind=material" : "/write"}
            className="rounded-full bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
          >
            + 새 {mode === "material" ? "자료" : "글"}
          </Link>
        </div>
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
          posts={rows}
          onChange={(updates) => {
            if (updates.categories) setCategories(updates.categories);
            if (updates.folders) setFolders(updates.folders);
          }}
        />

        <div>
          {(() => {
            const filtered = rows.filter((p) => {
              if (selectedCategory && p.category !== selectedCategory) return false;
              if (selectedFolder) {
                const ids = descendantIds(folders, selectedFolder);
                if (!p.folder_id || !ids.includes(p.folder_id)) return false;
              }
              return true;
            });
            if (loadingData) {
              return (
                <p className="py-10 text-center text-slate-500">불러오는 중...</p>
              );
            }
            if (filtered.length === 0) {
              return (
                <div className="rounded-lg border border-dashed border-sky-200 bg-white/60 p-10 text-center text-slate-500">
                  {selectedCategory || selectedFolder
                    ? "이 분류에 해당하는 글이 없어요."
                    : "아직 쓴 글이 없어요."}
                </div>
              );
            }
            return (
              <ul className="divide-y divide-sky-100">
                {filtered.map((p) => {
                const folder = p.folder_id
                  ? folders.find((f) => f.id === p.folder_id)
                  : null;
                return (
                  <li
                    key={p.id}
                    className="flex items-center gap-3 py-4"
                  >
                    <input
                      type="checkbox"
                      checked={picked.has(p.id)}
                      onChange={() => togglePick(p.id)}
                      className="h-4 w-4 shrink-0"
                      style={{ accentColor: "#0ea5e9" }}
                      title="내보내기 선택"
                    />
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
            );
          })()}
        </div>
      </div>
    </div>
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function sanitizeFilename(name: string): string {
  return (
    name
      .replace(/[\\/:*?"<>|]/g, "_")
      .replace(/\s+/g, " ")
      .trim() || "글"
  );
}
