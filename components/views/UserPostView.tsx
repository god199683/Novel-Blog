"use client";

import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase, type Profile, type Post } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import ArticleViewer from "@/components/ArticleViewer";

type Sibling = { id: string; title: string };

export default function UserPostView() {
  const { username, idOrSlug } = useParams<{
    username: string;
    idOrSlug: string;
  }>();
  const { user } = useAuth();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [post, setPost] = useState<Post | null>(null);
  const [prev, setPrev] = useState<Sibling | null>(null);
  const [next, setNext] = useState<Sibling | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const isOwner = useMemo(
    () => !!profile && !!user && profile.id === user.id,
    [profile, user]
  );

  useEffect(() => {
    if (!username || !idOrSlug) return;
    let active = true;
    (async () => {
      setLoading(true);
      setNotFound(false);
      const sb = supabase();

      // 1. 프로필
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

      // 2. 글 — UUID 형식이면 id로, 아니면 slug로
      const isUuid =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          idOrSlug
        );
      let row: Post | null = null;
      if (isUuid) {
        const { data } = await sb
          .from("posts")
          .select("*")
          .eq("id", idOrSlug)
          .maybeSingle();
        row = (data as Post | null) ?? null;
      }
      if (!row) {
        // slug로 시도 (NFC/NFD/원본)
        const candidates = Array.from(
          new Set([
            idOrSlug,
            idOrSlug.normalize("NFC"),
            idOrSlug.normalize("NFD"),
          ])
        );
        for (const s of candidates) {
          const { data } = await sb
            .from("posts")
            .select("*")
            .eq("author_id", (prof as Profile).id)
            .eq("slug", s)
            .maybeSingle();
          if (data) {
            row = data as Post;
            break;
          }
        }
      }
      if (!active) return;
      if (!row) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setPost(row);

      // 3. 같은 폴더 + 같은 종류(글/자료)만 형제로
      if (row.folder_id) {
        const { data: sibs } = await sb
          .from("posts")
          .select("id,title,published,created_at,kind")
          .eq("author_id", (prof as Profile).id)
          .eq("folder_id", row.folder_id)
          .eq("kind", row.kind ?? "post")
          .order("created_at", { ascending: true });
        if (active && sibs) {
          const filtered =
            user && (prof as Profile).id === user.id
              ? sibs
              : sibs.filter((s) => s.published);
          const idx = filtered.findIndex((s) => s.id === row!.id);
          setPrev(idx > 0 ? (filtered[idx - 1] as Sibling) : null);
          setNext(
            idx >= 0 && idx < filtered.length - 1
              ? (filtered[idx + 1] as Sibling)
              : null
          );
        }
      } else {
        setPrev(null);
        setNext(null);
      }

      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [username, idOrSlug, user]);

  if (loading) return <p className="py-10 text-center text-slate-500">불러오는 중...</p>;
  if (notFound)
    return (
      <div className="mx-auto max-w-md py-20 text-center">
        <h1 className="text-2xl font-bold text-slate-900">글을 찾을 수 없어요</h1>
        <Link to="/" className="mt-6 inline-block text-sm text-brand hover:underline">
          홈으로
        </Link>
      </div>
    );
  if (!profile || !post) return null;

  if (!post.published && !isOwner) {
    return (
      <div className="mx-auto max-w-md py-20 text-center">
        <h1 className="text-xl font-bold text-slate-900">비공개 글이에요</h1>
        <p className="mt-2 text-sm text-slate-500">
          이 글은 작성자만 볼 수 있어요.
        </p>
        <Link
          to={`/u/${profile.username}`}
          className="mt-6 inline-block text-sm text-brand hover:underline"
        >
          {profile.display_name}님의 블로그로 →
        </Link>
      </div>
    );
  }

  const isMaterial = post.kind === "material";
  const siblingBase = isMaterial
    ? `/u/${profile.username}/materials`
    : `/u/${profile.username}`;
  const profileLink = isMaterial
    ? `/u/${profile.username}/materials`
    : `/u/${profile.username}`;

  return (
    <article className="mx-auto max-w-3xl">
      <header className="mb-8 border-b border-sky-100 pb-6">
        <div className="mb-3 flex items-center gap-2 text-xs text-slate-500">
          {isMaterial && (
            <span className="rounded-full bg-purple-100 px-2 py-0.5 font-medium text-purple-700">
              자료
            </span>
          )}
          {!post.published && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-700">
              비공개
            </span>
          )}
          {post.category && (
            <span className="rounded-full bg-brand-light px-2 py-0.5 text-brand-dark">
              {post.category}
            </span>
          )}
          <time>{post.created_at.slice(0, 10)}</time>
        </div>
        <h1 className="text-3xl font-bold leading-snug text-slate-900">
          {post.title}
        </h1>
        <div className="mt-4 flex items-center justify-between">
          <Link
            to={profileLink}
            className="text-sm text-slate-700 hover:text-brand"
          >
            {profile.display_name}{" "}
            <span className="text-slate-400">@{profile.username}</span>
          </Link>
          {isOwner && (
            <Link
              to={`/edit/${post.id}`}
              className="rounded-full border border-sky-200 px-3 py-1 text-xs text-slate-700 hover:border-brand hover:text-brand"
            >
              수정
            </Link>
          )}
        </div>
      </header>
      <ArticleViewer
        key={post.id}
        html={post.content}
        title={post.title}
        authorName={profile.display_name}
        prevHref={prev ? `${siblingBase}/${prev.id}` : null}
        prevTitle={prev?.title ?? null}
        nextHref={next ? `${siblingBase}/${next.id}` : null}
        nextTitle={next?.title ?? null}
      />
    </article>
  );
}
