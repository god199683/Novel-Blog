"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { supabase, type Space, type SpaceSection } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import { slugify } from "@/lib/slug";
import Editor from "@/components/Editor";

export default function SpaceEditView() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const { user, profile, loading } = useAuth();

  const [space, setSpace] = useState<Space | null>(null);
  const [sections, setSections] = useState<SpaceSection[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [savingSection, setSavingSection] = useState(false);
  const [savingSpace, setSavingSpace] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 활성 섹션의 편집 값
  const [secTitle, setSecTitle] = useState("");
  const [secIcon, setSecIcon] = useState("📄");
  const [secContent, setSecContent] = useState("");

  useEffect(() => {
    if (!id) return;
    let active = true;
    (async () => {
      const sb = supabase();
      const [spaceRes, secsRes] = await Promise.all([
        sb.from("spaces").select("*").eq("id", id).maybeSingle(),
        sb
          .from("space_sections")
          .select("*")
          .eq("space_id", id)
          .order("sort_order")
          .order("created_at"),
      ]);
      if (!active) return;
      if (spaceRes.error) setError(spaceRes.error.message);
      setSpace((spaceRes.data as Space | null) ?? null);
      const list = (secsRes.data ?? []) as SpaceSection[];
      setSections(list);
      if (list.length > 0) setActiveId(list[0].id);
      setLoadingData(false);
    })();
    return () => {
      active = false;
    };
  }, [id]);

  // 활성 섹션 바뀔 때 편집 값 동기화
  useEffect(() => {
    const cur = sections.find((s) => s.id === activeId);
    if (cur) {
      setSecTitle(cur.title);
      setSecIcon(cur.icon);
      setSecContent(cur.content);
    }
  }, [activeId, sections]);

  const active = useMemo(
    () => sections.find((s) => s.id === activeId) ?? null,
    [sections, activeId]
  );

  if (loading || loadingData)
    return <p className="py-10 text-center text-slate-500">로딩...</p>;
  if (!user) return <Navigate to="/login" replace />;
  if (!space)
    return <p className="py-10 text-center text-slate-500">공간을 찾을 수 없어요.</p>;
  if (space.author_id !== user.id) return <Navigate to="/" replace />;

  // ---------- 공간(메타) 저장 ----------
  const saveSpaceMeta = async (patch: Partial<Space>) => {
    setSavingSpace(true);
    setError(null);
    const { error } = await supabase()
      .from("spaces")
      .update(patch)
      .eq("id", space.id);
    setSavingSpace(false);
    if (error) {
      setError(error.message);
      return;
    }
    setSpace({ ...space, ...patch });
  };

  const deleteSpace = async () => {
    if (!confirm(`'${space.title}' 공간을 삭제할까요? 모든 섹션이 함께 사라집니다.`))
      return;
    const { error } = await supabase().from("spaces").delete().eq("id", space.id);
    if (error) {
      setError(error.message);
      return;
    }
    nav("/spaces");
  };

  // ---------- 섹션 ----------
  const addSection = async () => {
    const t = window.prompt("새 섹션 이름 (예: 동식물 관리)", "");
    if (!t || !t.trim()) return;
    const title = t.trim();
    let slug = slugify(title);
    if (sections.some((s) => s.slug === slug))
      slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;
    const sortOrder = sections.length;
    const { data, error } = await supabase()
      .from("space_sections")
      .insert({
        space_id: space.id,
        slug,
        title,
        icon: "📄",
        content: "",
        sort_order: sortOrder,
      })
      .select()
      .single();
    if (error) return alert(error.message);
    const created = data as SpaceSection;
    setSections((cur) => [...cur, created]);
    setActiveId(created.id);
  };

  const saveActiveSection = useCallback(async () => {
    if (!active) return;
    setSavingSection(true);
    setError(null);
    const patch = {
      title: secTitle.trim() || "(이름 없음)",
      icon: secIcon || "📄",
      content: secContent,
    };
    const { error } = await supabase()
      .from("space_sections")
      .update(patch)
      .eq("id", active.id);
    setSavingSection(false);
    if (error) {
      setError(error.message);
      return;
    }
    setSections((cur) =>
      cur.map((s) => (s.id === active.id ? { ...s, ...patch } : s))
    );
  }, [active, secTitle, secIcon, secContent]);

  const deleteSection = async () => {
    if (!active) return;
    if (!confirm(`'${active.title}' 섹션을 삭제할까요?`)) return;
    const { error } = await supabase()
      .from("space_sections")
      .delete()
      .eq("id", active.id);
    if (error) return alert(error.message);
    const remaining = sections.filter((s) => s.id !== active.id);
    setSections(remaining);
    setActiveId(remaining[0]?.id ?? null);
  };

  const moveSection = async (delta: -1 | 1) => {
    if (!active) return;
    const idx = sections.findIndex((s) => s.id === active.id);
    const j = idx + delta;
    if (j < 0 || j >= sections.length) return;
    const reordered = [...sections];
    [reordered[idx], reordered[j]] = [reordered[j], reordered[idx]];
    const renumbered = reordered.map((s, i) => ({ ...s, sort_order: i }));
    setSections(renumbered);
    const sb = supabase();
    await Promise.all(
      renumbered.map((s) =>
        sb
          .from("space_sections")
          .update({ sort_order: s.sort_order })
          .eq("id", s.id)
      )
    );
  };

  return (
    <div className="grid gap-0 md:grid-cols-[260px_1fr] -mx-4 -mt-8 min-h-[calc(100vh-110px)]">
      {/* 사이드바 */}
      <aside className="border-r border-sky-100 bg-white px-4 py-6">
        <div className="mb-4 border-b border-sky-100 pb-4">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={space.icon}
              onChange={(e) => saveSpaceMeta({ icon: e.target.value || "🌳" })}
              maxLength={4}
              className="w-12 rounded border border-sky-100 bg-white px-1 py-1 text-center text-2xl outline-none focus:border-brand"
              title="아이콘 (이모지)"
            />
            <input
              type="text"
              value={space.title}
              onChange={(e) =>
                setSpace({ ...space, title: e.target.value })
              }
              onBlur={(e) =>
                saveSpaceMeta({ title: e.target.value.trim() || space.title })
              }
              className="flex-1 rounded border border-transparent bg-transparent px-1 py-1 text-base font-bold text-slate-800 outline-none focus:border-sky-200"
            />
          </div>
          <textarea
            value={space.description ?? ""}
            onChange={(e) =>
              setSpace({ ...space, description: e.target.value })
            }
            onBlur={(e) => saveSpaceMeta({ description: e.target.value })}
            placeholder="짧은 설명 (선택)"
            rows={2}
            className="mt-2 w-full resize-none rounded border border-sky-100 bg-white px-2 py-1 text-xs text-slate-600 outline-none focus:border-brand"
          />
          <div className="mt-2 flex items-center gap-2 text-xs">
            <button
              type="button"
              onClick={() => saveSpaceMeta({ published: !space.published })}
              className={`rounded-full px-2 py-0.5 ${
                space.published
                  ? "bg-brand text-white"
                  : "bg-amber-500 text-white"
              }`}
            >
              {space.published ? "🌐 공개" : "🔒 비공개"}
            </button>
            {savingSpace && <span className="text-slate-400">저장…</span>}
            {profile && (
              <a
                href={`#/u/${profile.username}/spaces/${space.slug}`}
                className="ml-auto text-slate-400 hover:text-brand"
                target="_blank"
                rel="noreferrer"
              >
                ↗
              </a>
            )}
          </div>
        </div>

        <nav className="space-y-1">
          {sections.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setActiveId(s.id)}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                activeId === s.id
                  ? "bg-brand-light text-brand-dark font-semibold"
                  : "text-slate-600 hover:bg-sky-50"
              }`}
            >
              <span className="text-lg">{s.icon}</span>
              <span className="truncate">{s.title}</span>
            </button>
          ))}
        </nav>

        <button
          type="button"
          onClick={addSection}
          className="mt-3 w-full rounded-lg border border-dashed border-sky-200 px-3 py-2 text-xs text-slate-500 hover:border-brand hover:text-brand"
        >
          + 섹션 추가
        </button>

        <div className="mt-6 border-t border-sky-100 pt-4">
          <button
            type="button"
            onClick={deleteSpace}
            className="text-xs text-red-500 hover:text-red-700"
          >
            공간 삭제
          </button>
        </div>
      </aside>

      {/* 본문 */}
      <main className="px-6 py-6">
        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
        {!active ? (
          <div className="rounded-lg border border-dashed border-sky-200 bg-white/60 p-10 text-center text-slate-500">
            왼쪽에서 섹션을 만들어 시작하세요.
          </div>
        ) : (
          <div>
            <div className="mb-4 flex flex-wrap items-center gap-2 border-b border-sky-100 pb-3">
              <input
                type="text"
                value={secIcon}
                onChange={(e) => setSecIcon(e.target.value || "📄")}
                maxLength={4}
                className="w-12 rounded border border-sky-200 bg-white px-1 py-1 text-center text-xl outline-none focus:border-brand"
              />
              <input
                type="text"
                value={secTitle}
                onChange={(e) => setSecTitle(e.target.value)}
                placeholder="섹션 제목"
                className="flex-1 rounded border border-sky-200 bg-white px-3 py-2 text-lg font-semibold text-slate-800 outline-none focus:border-brand"
              />
              <button
                type="button"
                onClick={() => moveSection(-1)}
                title="위로"
                className="rounded border border-sky-200 px-2 py-1 text-xs text-slate-500 hover:border-brand hover:text-brand"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => moveSection(1)}
                title="아래로"
                className="rounded border border-sky-200 px-2 py-1 text-xs text-slate-500 hover:border-brand hover:text-brand"
              >
                ↓
              </button>
              <button
                type="button"
                onClick={saveActiveSection}
                disabled={savingSection}
                className="rounded-full bg-brand px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50"
              >
                {savingSection ? "저장 중..." : "섹션 저장"}
              </button>
              <button
                type="button"
                onClick={deleteSection}
                className="rounded px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
              >
                삭제
              </button>
            </div>
            <Editor initialContent={secContent} onChange={setSecContent} />
          </div>
        )}
      </main>
    </div>
  );
}
