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

  // HTML 본문 → 단락 텍스트 배열 (단락 단위로 줄나눔)
  const htmlToParagraphs = (html: string): string[] => {
    if (!html) return [];
    // <br> 줄바꿈 보존, 단락성 태그를 \n\n 으로 분리
    const normalized = html
      .replace(/<\s*br\s*\/?\s*>/gi, "\n")
      .replace(/<\s*\/(p|div|h[1-6]|li|blockquote|pre)\s*>/gi, "\n\n")
      .replace(/<\s*li[^>]*>/gi, "• ")
      .replace(/<[^>]+>/g, "");
    return normalized
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .split(/\n\n+/)
      .map((s) => s.replace(/\n/g, " ").trim())
      .filter((s) => s.length > 0);
  };

  const exportPostAsTxt = (p: Post) => {
    const paragraphs = htmlToParagraphs(p.content);
    const meta = [
      p.kind === "material" ? "자료" : null,
      p.created_at.slice(0, 10),
      p.category,
    ]
      .filter(Boolean)
      .join(" · ");
    const text = [p.title, meta, "", ...paragraphs].join("\r\n");
    const blob = new Blob([`﻿${text}`], {
      type: "text/plain;charset=utf-8",
    });
    triggerDownload(blob, `${sanitizeFilename(p.title || "글")}.txt`);
  };

  const exportPostAsDocx = async (p: Post) => {
    const docx = await import("docx");
    const { Document, Packer, Paragraph, TextRun, HeadingLevel } = docx;
    const paragraphs = htmlToParagraphs(p.content);
    const meta = [
      p.kind === "material" ? "자료" : null,
      p.created_at.slice(0, 10),
      p.category,
    ]
      .filter(Boolean)
      .join(" · ");
    const children = [
      new Paragraph({
        text: p.title,
        heading: HeadingLevel.HEADING_1,
      }),
      ...(meta
        ? [
            new Paragraph({
              children: [
                new TextRun({ text: meta, italics: true, color: "64748B" }),
              ],
            }),
          ]
        : []),
      new Paragraph({}),
      ...paragraphs.map(
        (t) =>
          new Paragraph({
            children: [new TextRun(t)],
          })
      ),
    ];
    const doc = new Document({
      sections: [{ children }],
      creator: "Novel Blog",
      title: p.title,
    });
    const blob = await Packer.toBlob(doc);
    triggerDownload(blob, `${sanitizeFilename(p.title || "글")}.docx`);
  };

  const exportPicked = async (format: "txt" | "docx") => {
    if (picked.size === 0) return;
    setExporting(true);
    try {
      const list = rows.filter((p) => picked.has(p.id));
      for (const p of list) {
        if (format === "txt") exportPostAsTxt(p);
        else await exportPostAsDocx(p);
        // 브라우저 동시 다운로드 차단 회피
        await new Promise((r) => setTimeout(r, 250));
      }
    } catch (err) {
      alert(`내보내기 오류: ${err instanceof Error ? err.message : err}`);
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
        <div className="flex gap-2 flex-wrap items-center">
          {picked.size > 0 && (
            <>
              <span className="text-xs text-slate-500">
                {exporting
                  ? "내보내는 중..."
                  : `${picked.size}편 선택`}
              </span>
              <button
                type="button"
                onClick={() => exportPicked("txt")}
                disabled={exporting}
                className="rounded-full bg-brand-light px-3 py-2 text-sm font-medium text-brand-dark hover:opacity-90 disabled:opacity-60"
              >
                📄 .txt 내보내기
              </button>
              <button
                type="button"
                onClick={() => exportPicked("docx")}
                disabled={exporting}
                className="rounded-full bg-brand-light px-3 py-2 text-sm font-medium text-brand-dark hover:opacity-90 disabled:opacity-60"
              >
                📘 .docx 내보내기
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

function sanitizeFilename(name: string): string {
  return (
    name
      .replace(/[\\/:*?"<>|]/g, "_")
      .replace(/\s+/g, " ")
      .trim() || "글"
  );
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
