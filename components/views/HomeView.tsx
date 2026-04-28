"use client";

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";

type FeedRow = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  category: string | null;
  created_at: string;
  author: { username: string; display_name: string } | null;
};

export default function HomeView() {
  const [rows, setRows] = useState<FeedRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data, error } = await supabase()
        .from("posts")
        .select(
          "id,title,slug,excerpt,category,created_at,author:profiles!posts_author_id_fkey(username,display_name)"
        )
        .eq("published", true)
        .eq("kind", "post")
        .order("created_at", { ascending: false })
        .limit(30);
      if (!active) return;
      if (error) {
        console.error(error);
        setRows([]);
      } else {
        setRows((data ?? []) as unknown as FeedRow[]);
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div>
      <section className="mb-10">
        <h1 className="text-3xl font-bold text-slate-900">최신 이야기</h1>
        <p className="mt-2 text-slate-500">여러 작가의 소설과 에세이</p>
      </section>

      {loading ? (
        <p className="py-10 text-center text-slate-500">불러오는 중...</p>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-sky-200 bg-white/60 p-10 text-center text-slate-500">
          아직 작성된 글이 없어요.{" "}
          <Link to="/signup" className="text-brand underline">
            첫 글을 써보세요
          </Link>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {rows.map((p) => (
            <li
              key={p.id}
              className="group rounded-xl border border-sky-100 bg-white p-5 shadow-sm transition hover:border-brand hover:shadow-md"
            >
              <Link
                to={`/u/${p.author?.username ?? ""}/${p.id}`}
                className="block"
              >
                {p.category && (
                  <span className="mb-2 inline-block rounded-full bg-brand-light px-2 py-0.5 text-xs text-brand-dark">
                    {p.category}
                  </span>
                )}
                <h2 className="text-xl font-bold text-slate-900 group-hover:text-brand">
                  {p.title}
                </h2>
                {p.excerpt && (
                  <p className="mt-2 line-clamp-2 text-sm text-slate-600">
                    {p.excerpt}
                  </p>
                )}
              </Link>
              <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                {p.author && (
                  <Link
                    to={`/u/${p.author.username}`}
                    className="hover:text-brand"
                  >
                    {p.author.display_name}
                  </Link>
                )}
                <time>{p.created_at.slice(0, 10)}</time>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
