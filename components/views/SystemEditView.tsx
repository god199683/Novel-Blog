"use client";

import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import { parseSystem } from "@/lib/systemParser";
import { slugify, excerptFromHtml } from "@/lib/slug";
import SystemCard from "@/components/SystemCard";

const SAMPLE = `[ciel's Garden
  : 형태
    - 공간의 한 가운데에 거대한 세계수와 호수가 있고, 그 공간을 감싸듯 울타리와 큰 저택이 자리를 잡고 있음
      주변으로 구역들이 나뉘며 각자의 생태계를 유지하고 있음
  : 부여
    - 정원 관리 시스템
  : 기능
    - 정원 관리 시스템 (소유주와 파트너, 펫, 손님에게는 영향 없음)
      : 정원 내부 동식물 개체/쓰임새에 따라 자동으로 분류 및 구역 분리 (맞춤 환경과 먹이 자동 제공)
      : 무한 재배 및 성장 (기본 On, On/Off 가능)
          ※성장 단계(2) : 1단계 - 기본 성장 속도 2배, 2단계 - 즉시 성장
             Ex급으로 성장 시, 성장 멈춤
      : 소유주와 패스키 소유자들 외 출입 불가
      : 오염 방지와 자가 세척 마법 상시 발동 (동식물과 내부 건물, 시설 모두 포함)
      : 내부에서 얻을 수 있는 부산물/채집품은 Ex급까지 등급 올라감
]`;

export default function SystemEditView() {
  const { id } = useParams<{ id?: string }>();
  const isNew = !id;
  const nav = useNavigate();
  const { user, profile, loading } = useAuth();

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [published, setPublished] = useState(true);
  const [loadingPost, setLoadingPost] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isNew || !id) return;
    let active = true;
    (async () => {
      const { data, error } = await supabase()
        .from("posts")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (!active) return;
      if (error) setError(error.message);
      else if (data) {
        const p = data as {
          title: string;
          content: string;
          published: boolean;
          author_id: string;
        };
        setTitle(p.title);
        setContent(p.content);
        setPublished(p.published);
      }
      setLoadingPost(false);
    })();
    return () => {
      active = false;
    };
  }, [id, isNew]);

  const doc = useMemo(() => parseSystem(content), [content]);

  // 자동으로 파싱된 제목을 사용 — 사용자가 따로 입력 안 했을 때만
  useEffect(() => {
    if (!doc) return;
    if (!title.trim() && doc.title) setTitle(doc.title);
  }, [doc, title]);

  if (loading || loadingPost)
    return <p className="py-10 text-center text-slate-500">로딩...</p>;
  if (!user || !profile) return <Navigate to="/login" replace />;

  const handleSave = async () => {
    if (!content.trim()) {
      setError("내용을 붙여 넣어주세요");
      return;
    }
    const finalTitle = (title.trim() || doc?.title || "제목 없는 시스템").trim();
    setSaving(true);
    setError(null);
    const sb = supabase();

    if (isNew) {
      let baseSlug = slugify(finalTitle);
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
          title: finalTitle,
          content,
          excerpt: excerptFromHtml(content).slice(0, 160),
          published,
          kind: "system",
        })
        .select()
        .single();
      setSaving(false);
      if (error) {
        setError(error.message);
        return;
      }
      nav(`/systems/edit/${(data as { id: string }).id}`);
    } else if (id) {
      const { error } = await sb
        .from("posts")
        .update({
          title: finalTitle,
          content,
          excerpt: excerptFromHtml(content).slice(0, 160),
          published,
        })
        .eq("id", id);
      setSaving(false);
      if (error) {
        setError(error.message);
        return;
      }
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    if (!confirm("정말 삭제할까요?")) return;
    const { error } = await supabase().from("posts").delete().eq("id", id);
    if (error) {
      setError(error.message);
      return;
    }
    nav("/systems");
  };

  return (
    <div>
      <header className="mb-4 flex flex-wrap items-center gap-2">
        <h1 className="flex-1 text-xl font-bold text-slate-900">
          {isNew ? "새 시스템 카드" : "시스템 카드 수정"}
        </h1>
        <button
          type="button"
          onClick={() => setPublished((p) => !p)}
          className={`rounded-full px-3 py-1 text-xs ${
            published ? "bg-brand text-white" : "bg-amber-500 text-white"
          }`}
        >
          {published ? "🌐 공개" : "🔒 비공개"}
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-full bg-brand px-5 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50"
        >
          {saving ? "저장 중..." : "저장"}
        </button>
        {!isNew && (
          <button
            type="button"
            onClick={handleDelete}
            className="rounded px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
          >
            삭제
          </button>
        )}
      </header>
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="제목 (비워두면 형식 안 [제목]을 그대로 사용)"
        className="mb-3 w-full rounded border border-sky-200 bg-white px-3 py-2 text-sm focus:border-brand focus:outline-none"
      />

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="text-xs font-medium text-slate-600">
              형식 텍스트
            </label>
            {isNew && !content && (
              <button
                type="button"
                onClick={() => setContent(SAMPLE)}
                className="text-xs text-brand hover:underline"
              >
                예시 채우기
              </button>
            )}
          </div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            spellCheck={false}
            placeholder={`[제목\n  : 항목\n    - 내용\n      : 세부 항목\n          ※ 메모\n]`}
            className="h-[70vh] w-full resize-none rounded border border-sky-200 bg-white px-3 py-2 font-mono text-sm leading-relaxed focus:border-brand focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">
            미리보기
          </label>
          <div className="h-[70vh] overflow-auto rounded">
            <SystemCard doc={doc} />
          </div>
        </div>
      </div>
    </div>
  );
}
