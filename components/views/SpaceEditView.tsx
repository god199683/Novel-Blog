"use client";

import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
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

  if (loading || loadingData) {
    return (
      <div className="space-app flex min-h-screen items-center justify-center text-sm text-[var(--space-fg-muted)]">
        로딩...
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (!space) {
    return (
      <div className="space-app flex min-h-screen items-center justify-center text-sm text-[var(--space-fg-muted)]">
        공간을 찾을 수 없어요.
      </div>
    );
  }
  if (space.author_id !== user.id) return <Navigate to="/" replace />;

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

  const saveActiveSection = async () => {
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
  };

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
    <div className="space-app flex min-h-screen overflow-hidden">
      {/* 사이드바 */}
      <aside
        className="flex w-64 flex-col border-r"
        style={{ background: "var(--space-card)", borderColor: "var(--space-border)" }}
      >
        <header
          className="border-b p-6"
          style={{ borderColor: "var(--space-border)" }}
        >
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={space.icon}
              onChange={(e) => saveSpaceMeta({ icon: e.target.value || "🌳" })}
              maxLength={4}
              title="아이콘 (이모지)"
              className="w-10 rounded bg-transparent px-1 py-1 text-center text-2xl outline-none focus:ring-1 focus:ring-[var(--space-accent)]"
            />
            <input
              type="text"
              value={space.title}
              onChange={(e) => setSpace({ ...space, title: e.target.value })}
              onBlur={(e) =>
                saveSpaceMeta({ title: e.target.value.trim() || space.title })
              }
              className="flex-1 rounded bg-transparent px-1 py-1 text-xl font-bold outline-none focus:ring-1 focus:ring-[var(--space-accent)]"
              style={{ color: "var(--space-accent)" }}
            />
          </div>
          <input
            type="text"
            value={space.description ?? ""}
            onChange={(e) => setSpace({ ...space, description: e.target.value })}
            onBlur={(e) => saveSpaceMeta({ description: e.target.value })}
            placeholder="짧은 설명"
            className="mt-1 w-full rounded bg-transparent px-1 py-0.5 text-sm outline-none focus:ring-1 focus:ring-[var(--space-accent)]"
            style={{ color: "var(--space-fg-muted)" }}
          />
        </header>

        <nav className="flex-1 space-y-1 overflow-auto p-4">
          {sections.map((s) => {
            const isActive = activeId === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setActiveId(s.id)}
                className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-sm transition-colors"
                style={
                  isActive
                    ? {
                        background: "var(--space-accent-soft)",
                        color: "var(--space-accent)",
                        fontWeight: 600,
                      }
                    : {
                        color: "var(--space-fg-muted)",
                      }
                }
                onMouseEnter={(e) => {
                  if (!isActive) {
                    (e.currentTarget as HTMLElement).style.background =
                      "var(--space-card-hover)";
                    (e.currentTarget as HTMLElement).style.color =
                      "var(--space-fg)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    (e.currentTarget as HTMLElement).style.background =
                      "transparent";
                    (e.currentTarget as HTMLElement).style.color =
                      "var(--space-fg-muted)";
                  }
                }}
              >
                <span className="text-lg">{s.icon}</span>
                <span className="truncate">{s.title}</span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={addSection}
            className="mt-2 flex w-full items-center gap-2 rounded-lg border border-dashed px-4 py-2.5 text-xs transition-colors hover:border-[var(--space-accent)] hover:text-[var(--space-accent)]"
            style={{
              borderColor: "var(--space-border)",
              color: "var(--space-fg-soft)",
            }}
          >
            <span>+</span>
            <span>섹션 추가</span>
          </button>
        </nav>

        <footer
          className="border-t p-4"
          style={{ borderColor: "var(--space-border)" }}
        >
          <div className="mb-3 flex items-center gap-2 text-xs" style={{ color: "var(--space-fg-soft)" }}>
            <span
              className="pulse-glow h-2 w-2 rounded-full"
              style={{ background: "var(--space-accent)" }}
            />
            편집 모드
            {savingSpace && <span className="ml-auto">저장…</span>}
          </div>
          <div className="space-y-1.5 text-xs">
            <button
              type="button"
              onClick={() => saveSpaceMeta({ published: !space.published })}
              className="flex w-full items-center justify-between rounded px-2 py-1 transition-colors hover:bg-[var(--space-card-hover)]"
              style={{ color: "var(--space-fg-muted)" }}
            >
              <span>{space.published ? "🌐 공개" : "🔒 비공개"}</span>
              <span
                className="text-[10px] uppercase tracking-wider"
                style={{
                  color: space.published
                    ? "var(--space-accent)"
                    : "var(--space-fg-soft)",
                }}
              >
                {space.published ? "ON" : "OFF"}
              </span>
            </button>
            {profile && (
              <a
                href={`#/u/${profile.username}/spaces/${space.slug}`}
                className="flex items-center gap-1 rounded px-2 py-1 transition-colors hover:bg-[var(--space-card-hover)]"
                style={{ color: "var(--space-fg-muted)" }}
                target="_blank"
                rel="noreferrer"
              >
                ↗ 공개 페이지 보기
              </a>
            )}
            <Link
              to="/spaces"
              className="block rounded px-2 py-1 transition-colors hover:bg-[var(--space-card-hover)]"
              style={{ color: "var(--space-fg-muted)" }}
            >
              ← 공간 목록
            </Link>
            <button
              type="button"
              onClick={deleteSpace}
              className="flex w-full items-center rounded px-2 py-1 transition-colors hover:bg-red-500/10"
              style={{ color: "rgba(248,113,113,0.85)" }}
            >
              공간 삭제
            </button>
          </div>
        </footer>
      </aside>

      {/* 메인 */}
      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-5xl p-6">
          {error && (
            <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-300">
              {error}
            </div>
          )}
          {!active ? (
            <div
              className="rounded-xl border border-dashed p-16 text-center text-sm"
              style={{
                borderColor: "var(--space-border)",
                color: "var(--space-fg-muted)",
              }}
            >
              왼쪽에서 <strong style={{ color: "var(--space-accent)" }}>섹션 추가</strong>로 시작하세요.
            </div>
          ) : (
            <div
              className="rounded-2xl border p-6 shadow-sm"
              style={{
                background: "var(--space-card)",
                borderColor: "var(--space-border)",
              }}
            >
              <div
                className="mb-5 flex flex-wrap items-center gap-2 border-b pb-4"
                style={{ borderColor: "var(--space-border)" }}
              >
                <input
                  type="text"
                  value={secIcon}
                  onChange={(e) => setSecIcon(e.target.value || "📄")}
                  maxLength={4}
                  className="w-12 rounded bg-transparent px-1 py-1 text-center text-xl outline-none focus:ring-1 focus:ring-[var(--space-accent)]"
                />
                <input
                  type="text"
                  value={secTitle}
                  onChange={(e) => setSecTitle(e.target.value)}
                  placeholder="섹션 제목"
                  className="flex-1 rounded bg-transparent px-2 py-1 text-2xl font-bold outline-none focus:ring-1 focus:ring-[var(--space-accent)]"
                />
                <button
                  type="button"
                  onClick={() => moveSection(-1)}
                  title="위로"
                  className="rounded border px-2 py-1 text-xs transition-colors hover:border-[var(--space-accent)] hover:text-[var(--space-accent)]"
                  style={{
                    borderColor: "var(--space-border)",
                    color: "var(--space-fg-muted)",
                  }}
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => moveSection(1)}
                  title="아래로"
                  className="rounded border px-2 py-1 text-xs transition-colors hover:border-[var(--space-accent)] hover:text-[var(--space-accent)]"
                  style={{
                    borderColor: "var(--space-border)",
                    color: "var(--space-fg-muted)",
                  }}
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={saveActiveSection}
                  disabled={savingSection}
                  className="rounded-full px-4 py-1.5 text-sm font-medium text-white transition-colors disabled:opacity-50"
                  style={{ background: "var(--space-accent)" }}
                >
                  {savingSection ? "저장 중..." : "섹션 저장"}
                </button>
                <button
                  type="button"
                  onClick={deleteSection}
                  className="rounded px-3 py-1.5 text-sm text-red-600 transition-colors hover:bg-red-50"
                >
                  삭제
                </button>
              </div>
              <Editor initialContent={secContent} onChange={setSecContent} />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
