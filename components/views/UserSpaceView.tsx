"use client";

import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  supabase,
  type Profile,
  type Space,
  type SpaceSection,
} from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";

export default function UserSpaceView() {
  const { username, slug, sectionSlug } = useParams<{
    username: string;
    slug: string;
    sectionSlug?: string;
  }>();
  const nav = useNavigate();
  const { user } = useAuth();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [space, setSpace] = useState<Space | null>(null);
  const [sections, setSections] = useState<SpaceSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!username || !slug) return;
    let active = true;
    (async () => {
      setLoading(true);
      setNotFound(false);
      const sb = supabase();
      const { data: prof } = await sb
        .from("profiles")
        .select("*")
        .eq("username", username.toLowerCase())
        .maybeSingle();
      if (!active) return;
      if (!prof) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setProfile(prof as Profile);

      const { data: spaceRow } = await sb
        .from("spaces")
        .select("*")
        .eq("author_id", (prof as Profile).id)
        .eq("slug", slug)
        .maybeSingle();
      if (!active) return;
      if (!spaceRow) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setSpace(spaceRow as Space);

      const { data: secs } = await sb
        .from("space_sections")
        .select("*")
        .eq("space_id", (spaceRow as Space).id)
        .order("sort_order")
        .order("created_at");
      if (!active) return;
      setSections((secs ?? []) as SpaceSection[]);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [username, slug]);

  const active = useMemo(() => {
    if (!sections.length) return null;
    if (sectionSlug) return sections.find((s) => s.slug === sectionSlug) ?? null;
    return sections[0];
  }, [sections, sectionSlug]);

  if (loading) return <p className="py-10 text-center text-slate-500">불러오는 중...</p>;
  if (notFound)
    return (
      <div className="mx-auto max-w-md py-20 text-center">
        <h1 className="text-2xl font-bold text-slate-900">공간을 찾을 수 없어요</h1>
        <Link to="/" className="mt-6 inline-block text-sm text-brand hover:underline">
          홈으로
        </Link>
      </div>
    );
  if (!profile || !space) return null;

  const isOwner = !!user && user.id === profile.id;
  if (!space.published && !isOwner) {
    return (
      <div className="mx-auto max-w-md py-20 text-center">
        <h1 className="text-xl font-bold text-slate-900">비공개 공간이에요</h1>
        <Link
          to={`/u/${profile.username}`}
          className="mt-6 inline-block text-sm text-brand hover:underline"
        >
          {profile.display_name}님의 블로그로 →
        </Link>
      </div>
    );
  }

  const baseHref = `/u/${profile.username}/spaces/${space.slug}`;

  return (
    <div className="grid gap-0 md:grid-cols-[260px_1fr] -mx-4 -mt-8 min-h-[calc(100vh-110px)]">
      <aside className="border-r border-sky-100 bg-white px-4 py-6">
        <header className="mb-4 border-b border-sky-100 pb-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{space.icon}</span>
            <h1 className="truncate text-base font-bold text-slate-800">
              {space.title}
            </h1>
          </div>
          {space.description && (
            <p className="mt-2 text-xs text-slate-500">{space.description}</p>
          )}
          <p className="mt-3 flex items-center gap-2 text-xs text-slate-500">
            <Link
              to={`/u/${profile.username}`}
              className="hover:text-brand"
            >
              @{profile.username}
            </Link>
            {!space.published && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-700">
                비공개
              </span>
            )}
          </p>
          {isOwner && (
            <Link
              to={`/spaces/${space.id}`}
              className="mt-3 inline-block text-xs text-slate-500 hover:text-brand"
            >
              ✎ 편집하기
            </Link>
          )}
        </header>

        <nav className="space-y-1">
          {sections.length === 0 ? (
            <p className="px-3 py-2 text-xs text-slate-400">아직 섹션이 없어요</p>
          ) : (
            sections.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => nav(`${baseHref}/${s.slug}`)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                  active?.id === s.id
                    ? "bg-brand-light text-brand-dark font-semibold"
                    : "text-slate-600 hover:bg-sky-50"
                }`}
              >
                <span className="text-lg">{s.icon}</span>
                <span className="truncate">{s.title}</span>
              </button>
            ))
          )}
        </nav>
      </aside>

      <main className="overflow-auto px-6 py-6">
        {!active ? (
          <p className="py-20 text-center text-slate-500">
            아직 표시할 섹션이 없어요.
          </p>
        ) : (
          <article className="mx-auto max-w-3xl">
            <header className="mb-6 flex items-center gap-3 border-b border-sky-100 pb-4">
              <span className="text-3xl">{active.icon}</span>
              <h2 className="text-2xl font-bold text-slate-900">
                {active.title}
              </h2>
            </header>
            {active.content ? (
              <div
                className="article-body"
                dangerouslySetInnerHTML={{ __html: active.content }}
              />
            ) : (
              <p className="py-10 text-center text-slate-400">
                아직 내용이 없어요.
              </p>
            )}
          </article>
        )}
      </main>
    </div>
  );
}
