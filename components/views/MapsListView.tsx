"use client";

import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { supabase, type NovelMap } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";

export default function MapsListView() {
  const { user, profile, loading } = useAuth();
  const [rows, setRows] = useState<NovelMap[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!user) return;
    let active = true;
    (async () => {
      const { data } = await supabase()
        .from("maps")
        .select("*")
        .eq("author_id", user.id)
        .order("updated_at", { ascending: false });
      if (!active) return;
      setRows((data ?? []) as NovelMap[]);
      setLoadingData(false);
    })();
    return () => {
      active = false;
    };
  }, [user]);

  if (loading) return <p className="py-10 text-center text-slate-500">로딩...</p>;
  if (!user || !profile) return <Navigate to="/login" replace />;

  return (
    <div>
      <header className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">내 지도</h1>
          <p className="mt-1 text-sm text-slate-500">
            아공간·던전·세계 지도를 만들고 공유하세요
          </p>
        </div>
        <Link
          to="/maps/new"
          className="rounded-full bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
        >
          + 새 지도
        </Link>
      </header>

      {loadingData ? (
        <p className="py-10 text-center text-slate-500">불러오는 중...</p>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-sky-200 bg-white/60 p-10 text-center text-slate-500">
          아직 만든 지도가 없어요.
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((m) => (
            <li
              key={m.id}
              className="rounded-xl border border-sky-100 bg-white p-4 shadow-sm transition hover:border-brand hover:shadow-md"
            >
              <Link to={`/maps/edit/${m.id}`} className="block">
                <div
                  className="mb-3 h-32 w-full rounded ring-1 ring-sky-100"
                  style={{ background: m.background_color }}
                />
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  {!m.published && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-700">
                      비공개
                    </span>
                  )}
                  <time>{m.updated_at.slice(0, 10)}</time>
                </div>
                <h2 className="mt-1 truncate font-semibold text-slate-800">
                  🗺️ {m.title}
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  핀 {m.data?.pins?.length ?? 0}개 · 방{" "}
                  {m.data?.rects?.length ?? 0}개 · 선{" "}
                  {m.data?.lines?.length ?? 0}개
                </p>
              </Link>
              <div className="mt-3 flex items-center gap-2 text-xs">
                <Link
                  to={`/u/${profile.username}/maps/${m.id}`}
                  className="rounded-full border border-sky-200 px-2 py-1 text-slate-600 hover:border-brand hover:text-brand"
                >
                  공개 보기
                </Link>
                <Link
                  to={`/maps/edit/${m.id}`}
                  className="rounded-full border border-sky-200 px-2 py-1 text-slate-600 hover:border-brand hover:text-brand"
                >
                  수정
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
