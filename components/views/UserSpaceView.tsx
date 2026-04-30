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

  if (loading) {
    return (
      <div className="space-app flex min-h-screen items-center justify-center text-sm text-[var(--space-fg-muted)]">
        불러오는 중...
      </div>
    );
  }
  if (notFound) {
    return (
      <div className="space-app flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-[var(--space-accent)]">
            공간을 찾을 수 없어요
          </h1>
          <Link
            to="/"
            className="mt-6 inline-block text-sm hover:underline"
            style={{ color: "var(--space-fg-muted)" }}
          >
            홈으로
          </Link>
        </div>
      </div>
    );
  }
  if (!profile || !space) return null;

  const isOwner = !!user && user.id === profile.id;
  if (!space.published && !isOwner) {
    return (
      <div className="space-app flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="text-xl font-bold text-[var(--space-accent)]">
            비공개 공간이에요
          </h1>
          <Link
            to={`/u/${profile.username}`}
            className="mt-6 inline-block text-sm hover:underline"
            style={{ color: "var(--space-fg-muted)" }}
          >
            {profile.display_name}님의 블로그로 →
          </Link>
        </div>
      </div>
    );
  }

  const baseHref = `/u/${profile.username}/spaces/${space.slug}`;

  return (
    <div className="space-app flex min-h-screen overflow-hidden">
      <aside
        className="flex w-64 flex-col border-r"
        style={{
          background: "var(--space-card)",
          borderColor: "var(--space-border)",
        }}
      >
        <header
          className="border-b p-6"
          style={{ borderColor: "var(--space-border)" }}
        >
          <div className="flex items-center gap-2">
            <span className="text-2xl">{space.icon}</span>
            <h1
              className="truncate text-xl font-bold"
              style={{ color: "var(--space-accent)" }}
            >
              {space.title}
            </h1>
          </div>
          {space.description && (
            <p
              className="mt-1 text-sm"
              style={{ color: "var(--space-fg-muted)" }}
            >
              {space.description}
            </p>
          )}
        </header>

        <nav className="flex-1 space-y-1 overflow-auto p-4">
          {sections.length === 0 ? (
            <p
              className="px-4 py-3 text-xs"
              style={{ color: "var(--space-fg-soft)" }}
            >
              아직 섹션이 없어요
            </p>
          ) : (
            sections.map((s) => {
              const isActive = active?.id === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => nav(`${baseHref}/${s.slug}`)}
                  className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-sm transition-colors"
                  style={
                    isActive
                      ? {
                          background: "var(--space-accent-soft)",
                          color: "var(--space-accent)",
                          fontWeight: 600,
                        }
                      : { color: "var(--space-fg-muted)" }
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
            })
          )}
        </nav>

        <footer
          className="border-t p-4"
          style={{ borderColor: "var(--space-border)" }}
        >
          <div
            className="mb-3 flex items-center gap-2 text-xs"
            style={{ color: "var(--space-fg-soft)" }}
          >
            <span
              className="pulse-glow h-2 w-2 rounded-full"
              style={{ background: "var(--space-accent)" }}
            />
            시스템 활성 중
          </div>
          <div className="space-y-1.5 text-xs">
            <Link
              to={`/u/${profile.username}`}
              className="block rounded px-2 py-1 transition-colors hover:bg-[var(--space-card-hover)]"
              style={{ color: "var(--space-fg-muted)" }}
            >
              ← @{profile.username}의 블로그
            </Link>
            {isOwner && (
              <Link
                to={`/spaces/${space.id}`}
                className="block rounded px-2 py-1 transition-colors hover:bg-[var(--space-card-hover)]"
                style={{ color: "var(--space-fg-muted)" }}
              >
                ✎ 편집
              </Link>
            )}
          </div>
        </footer>
      </aside>

      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-5xl p-6">
          {!active ? (
            <p
              className="py-20 text-center text-sm"
              style={{ color: "var(--space-fg-muted)" }}
            >
              아직 표시할 섹션이 없어요.
            </p>
          ) : (
            <article
              className="rounded-2xl border p-8"
              style={{
                background: "var(--space-card)",
                borderColor: "var(--space-border)",
              }}
            >
              <header
                className="mb-6 flex items-center gap-3 border-b pb-4"
                style={{ borderColor: "var(--space-border)" }}
              >
                <span className="text-3xl">{active.icon}</span>
                <h2
                  className="text-2xl font-bold"
                  style={{ color: "var(--space-accent)" }}
                >
                  {active.title}
                </h2>
              </header>
              {active.content ? (
                <div className="rounded-lg bg-white p-6 text-slate-900">
                  <div
                    className="article-body"
                    dangerouslySetInnerHTML={{ __html: active.content }}
                  />
                </div>
              ) : (
                <p
                  className="py-10 text-center"
                  style={{ color: "var(--space-fg-soft)" }}
                >
                  아직 내용이 없어요.
                </p>
              )}
            </article>
          )}
        </div>
      </main>
    </div>
  );
}
