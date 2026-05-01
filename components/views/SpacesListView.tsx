"use client";

import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { supabase, type Space } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import { slugify } from "@/lib/slug";

export default function SpacesListView() {
  const nav = useNavigate();
  const { user, profile, loading } = useAuth();
  const [rows, setRows] = useState<Space[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let active = true;
    (async () => {
      const { data } = await supabase()
        .from("spaces")
        .select("*")
        .eq("author_id", user.id)
        .order("updated_at", { ascending: false });
      if (!active) return;
      setRows((data ?? []) as Space[]);
      setLoadingData(false);
    })();
    return () => {
      active = false;
    };
  }, [user]);

  if (loading) return <p className="py-10 text-center text-slate-500">로딩...</p>;
  if (!user || !profile) return <Navigate to="/login" replace />;

  const createSpace = async () => {
    const title = window.prompt("새 공간 이름 (예: Ciel's Garden)", "");
    if (!title || !title.trim()) return;
    const t = title.trim();
    let baseSlug = slugify(t);
    let slug = baseSlug;
    setCreating(true);
    setError(null);
    const sb = supabase();
    let attempt = 0;
    while (attempt < 3) {
      const { data: existing } = await sb
        .from("spaces")
        .select("id")
        .eq("author_id", user.id)
        .eq("slug", slug)
        .maybeSingle();
      if (!existing) break;
      slug = `${baseSlug}-${Math.random().toString(36).slice(2, 7)}`;
      attempt++;
    }
    const { data, error } = await sb
      .from("spaces")
      .insert({
        author_id: user.id,
        slug,
        title: t,
        icon: "🌳",
      })
      .select()
      .single();
    setCreating(false);
    if (error) {
      setError(error.message);
      return;
    }
    nav(`/spaces/${(data as { id: string }).id}`);
  };

  return (
    <div>
      <header className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">내 공간</h1>
          <p className="mt-1 text-sm text-slate-500">
            소설의 세계관·시스템·관리 페이지를 사이드바와 섹션으로 묶어 한 번에 보여줘요
          </p>
        </div>
        <button
          type="button"
          onClick={createSpace}
          disabled={creating}
          className="rounded-full bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50"
        >
          {creating ? "만드는 중..." : "+ 새 공간"}
        </button>
      </header>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {loadingData ? (
        <p className="py-10 text-center text-slate-500">불러오는 중...</p>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-sky-200 bg-white/60 p-10 text-center text-slate-500">
          아직 만든 공간이 없어요.
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((s) => (
            <li
              key={s.id}
              className="card-hover rounded-xl border border-[#c7ddf5] bg-white p-5 shadow-sm"
              style={{ transition: "transform 0.2s ease, box-shadow 0.2s ease" }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow =
                  "0 8px 25px rgba(74, 168, 216, 0.18)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "";
                e.currentTarget.style.boxShadow = "";
              }}
            >
              <Link to={`/spaces/${s.id}`} className="block">
                <div className="text-4xl">{s.icon}</div>
                <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                  {!s.published && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-700">
                      비공개
                    </span>
                  )}
                  <time>{s.updated_at.slice(0, 10)}</time>
                </div>
                <h2
                  className="mt-1 truncate text-lg font-bold"
                  style={{ color: "#1e3a5f" }}
                >
                  {s.title}
                </h2>
                {s.description && (
                  <p className="mt-1 line-clamp-2 text-xs text-slate-500">
                    {s.description}
                  </p>
                )}
              </Link>
              <div className="mt-4 flex items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={async () => {
                    const next = !s.published;
                    if (
                      s.published &&
                      !confirm(
                        `'${s.title}'을(를) 비공개로 전환할까요?`
                      )
                    )
                      return;
                    const { error } = await supabase()
                      .from("spaces")
                      .update({ published: next })
                      .eq("id", s.id);
                    if (error) {
                      alert(error.message);
                      return;
                    }
                    setRows((cur) =>
                      cur.map((x) =>
                        x.id === s.id ? { ...x, published: next } : x
                      )
                    );
                  }}
                  className="rounded-full border px-2 py-1"
                  style={{
                    borderColor: "#c7ddf5",
                    color: s.published ? "#16a34a" : "#d97706",
                  }}
                >
                  {s.published ? "🌐 공개" : "🔒 비공개"}
                </button>
                {s.published && (
                  <Link
                    to={`/u/${profile.username}/spaces/${s.slug}`}
                    className="rounded-full border px-2 py-1 text-slate-600 hover:text-[#4aa8d8]"
                    style={{ borderColor: "#c7ddf5" }}
                  >
                    공개 보기 →
                  </Link>
                )}
                <Link
                  to={`/spaces/${s.id}`}
                  className="rounded-full px-3 py-1 text-white"
                  style={{ background: "#4aa8d8" }}
                >
                  편집
                </Link>
                <button
                  type="button"
                  onClick={async () => {
                    if (
                      !confirm(
                        `'${s.title}' 공간을 삭제할까요?\n구역·동식물·부산물·설정·출입 데이터가 모두 함께 사라집니다. 되돌릴 수 없어요.`
                      )
                    )
                      return;
                    const { error } = await supabase()
                      .from("spaces")
                      .delete()
                      .eq("id", s.id);
                    if (error) {
                      alert(error.message);
                      return;
                    }
                    setRows((cur) => cur.filter((x) => x.id !== s.id));
                  }}
                  className="ml-auto rounded-full border px-2 py-1 text-red-600 hover:bg-red-50"
                  style={{ borderColor: "#fecaca" }}
                  title="이 공간 삭제"
                >
                  삭제
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
