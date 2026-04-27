"use client";

import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { supabase, type Post } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";

export default function DashboardView() {
  const { user, profile, loading } = useAuth();
  const [rows, setRows] = useState<Post[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);

  useEffect(() => {
    if (!user) return;
    let active = true;
    (async () => {
      const { data } = await supabase()
        .from("posts")
        .select("*")
        .eq("author_id", user.id)
        .order("updated_at", { ascending: false });
      if (!active) return;
      setRows((data ?? []) as Post[]);
      setLoadingPosts(false);
    })();
    return () => {
      active = false;
    };
  }, [user]);

  if (loading) return <p className="py-10 text-center text-slate-500">로딩...</p>;
  if (!user) return <Navigate to="/login" replace />;

  return (
    <div>
      <header className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">내 글 관리</h1>
          {profile && (
            <p className="mt-1 text-sm text-slate-500">
              <Link to={`/u/${profile.username}`} className="hover:text-brand">
                내 블로그 보기 →
              </Link>
            </p>
          )}
        </div>
        <Link
          to="/write"
          className="rounded-full bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
        >
          + 새 글
        </Link>
      </header>

      {loadingPosts ? (
        <p className="py-10 text-center text-slate-500">불러오는 중...</p>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-sky-200 bg-white/60 p-10 text-center text-slate-500">
          아직 쓴 글이 없어요.
        </div>
      ) : (
        <ul className="divide-y divide-sky-100">
          {rows.map((p) => (
            <li key={p.id} className="flex items-center justify-between py-4">
              <Link
                to={`/u/${profile?.username ?? ""}/${p.id}`}
                className="flex-1"
              >
                <div className="flex items-center gap-2 text-xs text-slate-500">
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
          ))}
        </ul>
      )}
    </div>
  );
}
