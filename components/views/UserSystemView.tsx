"use client";

import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase, type Profile, type Post } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import { parseSystem } from "@/lib/systemParser";
import SystemCard from "@/components/SystemCard";

export default function UserSystemView() {
  const { username, id } = useParams<{ username: string; id: string }>();
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!username || !id) return;
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

      const { data: row } = await sb
        .from("posts")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (!active) return;
      if (!row) setNotFound(true);
      else setPost(row as Post);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [username, id]);

  const doc = useMemo(
    () => (post ? parseSystem(post.content) : null),
    [post]
  );

  if (loading) return <p className="py-10 text-center text-slate-500">불러오는 중...</p>;
  if (notFound)
    return (
      <div className="mx-auto max-w-md py-20 text-center">
        <h1 className="text-2xl font-bold text-slate-900">시스템 카드를 찾을 수 없어요</h1>
        <Link to="/" className="mt-6 inline-block text-sm text-brand hover:underline">
          홈으로
        </Link>
      </div>
    );
  if (!profile || !post) return null;

  const isOwner = !!user && user.id === profile.id;
  if (!post.published && !isOwner) {
    return (
      <div className="mx-auto max-w-md py-20 text-center">
        <h1 className="text-xl font-bold text-slate-900">비공개 시스템 카드예요</h1>
        <Link
          to={`/u/${profile.username}`}
          className="mt-6 inline-block text-sm text-brand hover:underline"
        >
          {profile.display_name}님의 블로그로 →
        </Link>
      </div>
    );
  }

  return (
    <article className="mx-auto max-w-3xl">
      <header className="mb-4 flex items-center justify-between">
        <Link
          to={`/u/${profile.username}`}
          className="text-sm text-slate-700 hover:text-brand"
        >
          {profile.display_name}{" "}
          <span className="text-slate-400">@{profile.username}</span>
        </Link>
        {isOwner && (
          <Link
            to={`/systems/edit/${post.id}`}
            className="rounded-full border border-sky-200 px-3 py-1 text-xs text-slate-700 hover:border-brand hover:text-brand"
          >
            수정
          </Link>
        )}
      </header>
      <SystemCard doc={doc} />
    </article>
  );
}
