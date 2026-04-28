"use client";

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase, type Category, type Folder } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import { slugify, excerptFromHtml } from "@/lib/slug";
import Editor from "./Editor";

type Initial = {
  id?: string;
  title: string;
  content: string;
  category: string | null;
  folderId?: string | null;
  published?: boolean;
  kind?: "post" | "material";
};

export default function PostForm({
  initial,
  kind = "post",
}: {
  initial?: Initial;
  kind?: "post" | "material";
}) {
  const nav = useNavigate();
  const { user, profile } = useAuth();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [content, setContent] = useState(initial?.content ?? "");
  const [category, setCategory] = useState(initial?.category ?? "");
  const [folderId, setFolderId] = useState<string>(initial?.folderId ?? "");
  const [published, setPublished] = useState<boolean>(initial?.published ?? true);
  const [cats, setCats] = useState<Category[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [newCat, setNewCat] = useState("");
  const [newFolder, setNewFolder] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const sb = supabase();
    sb.from("categories")
      .select("*")
      .eq("user_id", user.id)
      .order("sort_order")
      .then(({ data }) => setCats((data ?? []) as Category[]));
    sb.from("folders")
      .select("*")
      .eq("user_id", user.id)
      .order("sort_order")
      .then(({ data }) => setFolders((data ?? []) as Folder[]));
  }, [user]);

  const addCategory = async () => {
    const name = newCat.trim();
    if (!name || !user) return;
    const { data, error } = await supabase()
      .from("categories")
      .insert({ user_id: user.id, name, sort_order: cats.length })
      .select()
      .single();
    if (error) {
      setError(error.message);
      return;
    }
    setCats((cs) => [...cs, data as Category]);
    setCategory((data as Category).name);
    setNewCat("");
  };

  const addFolder = async () => {
    const name = newFolder.trim();
    if (!name || !user) return;
    const { data, error } = await supabase()
      .from("folders")
      .insert({ user_id: user.id, name, sort_order: folders.length })
      .select()
      .single();
    if (error) {
      setError(error.message);
      return;
    }
    setFolders((fs) => [...fs, data as Folder]);
    setFolderId((data as Folder).id);
    setNewFolder("");
  };

  const submit = async () => {
    if (!user || !profile) return;
    if (!title.trim()) {
      setError("제목을 입력해 주세요");
      return;
    }
    setError(null);
    setSaving(true);
    const sb = supabase();

    const effectiveKind = initial?.kind ?? kind;
    const viewBase =
      effectiveKind === "material"
        ? `/u/${profile.username}/materials`
        : `/u/${profile.username}`;

    if (initial?.id) {
      // 수정 — slug는 그대로 둠
      const { data, error } = await sb
        .from("posts")
        .update({
          title: title.trim(),
          content,
          excerpt: excerptFromHtml(content),
          category: category || null,
          folder_id: folderId || null,
          published,
        })
        .eq("id", initial.id)
        .select()
        .single();
      setSaving(false);
      if (error) {
        setError(error.message);
        return;
      }
      nav(`${viewBase}/${(data as { id: string }).id}`);
    } else {
      // 새 글 — slug 생성, 충돌 시 -랜덤 접미사 추가
      const baseSlug = slugify(title.trim());
      let slug = baseSlug;
      let attempt = 0;
      while (attempt < 3) {
        const { data: existing } = await sb
          .from("posts")
          .select("id")
          .eq("author_id", user.id)
          .eq("slug", slug)
          .maybeSingle();
        if (!existing) break;
        slug = `${baseSlug}-${Math.random().toString(36).slice(2, 7)}`;
        attempt++;
      }

      const { data, error } = await sb
        .from("posts")
        .insert({
          author_id: user.id,
          slug,
          title: title.trim(),
          content,
          excerpt: excerptFromHtml(content),
          category: category || null,
          folder_id: folderId || null,
          published,
          kind: effectiveKind,
        })
        .select()
        .single();
      setSaving(false);
      if (error) {
        setError(error.message);
        return;
      }
      nav(`${viewBase}/${(data as { id: string }).id}`);
    }
  };

  const remove = async () => {
    if (!initial?.id) return;
    if (!confirm("정말 삭제하시겠습니까?")) return;
    setSaving(true);
    const { error } = await supabase()
      .from("posts")
      .delete()
      .eq("id", initial.id);
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    nav("/dashboard");
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
            <button
              key={c.id}
              type="button"
              onClick={() => setCategory(c.name)}
              className={`rounded-full px-3 py-1 text-xs ${
                category === c.name
                  ? "bg-brand text-white"
                  : "border border-sky-200 text-slate-700 hover:border-brand"
              }`}
            >
              {c.name}
            </button>
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
            <button
              key={f.id}
              type="button"
              onClick={() => setFolderId(f.id)}
              className={`rounded-full px-3 py-1 text-xs ${
                folderId === f.id
                  ? "bg-brand text-white"
                  : "border border-sky-200 text-slate-700 hover:border-brand"
              }`}
            >
              📁 {f.name}
            </button>
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

      <div className="sticky top-14 z-20 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-sky-100 bg-white/80 px-3 py-2 shadow-sm backdrop-blur">
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-500">공개 설정</span>
          <button
            type="button"
            onClick={() => setPublished(true)}
            className={`rounded-full px-3 py-1 text-xs ${
              published
                ? "bg-brand text-white"
                : "border border-sky-200 text-slate-600 hover:border-brand"
            }`}
          >
            🌐 공개
          </button>
          <button
            type="button"
            onClick={() => setPublished(false)}
            className={`rounded-full px-3 py-1 text-xs ${
              !published
                ? "bg-amber-500 text-white"
                : "border border-sky-200 text-slate-600 hover:border-amber-400"
            }`}
          >
            🔒 비공개
          </button>
        </div>
        <div className="flex items-center gap-2">
          {initial?.id && (
            <button
              type="button"
              onClick={remove}
              disabled={saving}
              className="rounded px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              삭제
            </button>
          )}
          <button
            type="button"
            onClick={submit}
            disabled={saving}
            className="rounded-full bg-brand px-5 py-1.5 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50"
          >
            {saving
              ? "저장 중..."
              : initial?.id
              ? "수정"
              : published
              ? "발행"
              : "비공개로 저장"}
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <Editor initialContent={content} onChange={setContent} />
    </div>
  );
}
