"use client";

import { useEffect, useState } from "react";
import { Link, Outlet, useParams } from "react-router-dom";
import { supabase, type Profile, type Space } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import SpaceShell from "@/components/space/SpaceShell";
import { SpaceProvider } from "@/components/space/SpaceContext";

type Mode = "owner" | "public";

export default function SpaceLayout({ mode }: { mode: Mode }) {
  const params = useParams<{ id?: string; username?: string; slug?: string }>();
  const { user } = useAuth();
  const [space, setSpace] = useState<Space | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const sb = supabase();
      if (mode === "owner" && params.id) {
        const { data, error } = await sb
          .from("spaces")
          .select("*")
          .eq("id", params.id)
          .maybeSingle();
        if (!active) return;
        if (error) setError(error.message);
        setSpace((data as Space | null) ?? null);
        if (data) {
          const { data: prof } = await sb
            .from("profiles")
            .select("*")
            .eq("id", (data as Space).author_id)
            .maybeSingle();
          if (active) setProfile((prof as Profile | null) ?? null);
        }
      } else if (mode === "public" && params.username && params.slug) {
        const { data: prof } = await sb
          .from("profiles")
          .select("*")
          .eq("username", params.username.toLowerCase())
          .maybeSingle();
        if (!active) return;
        if (prof) setProfile(prof as Profile);
        if (prof) {
          const { data: spaceRow } = await sb
            .from("spaces")
            .select("*")
            .eq("author_id", (prof as Profile).id)
            .eq("slug", params.slug)
            .maybeSingle();
          if (active) setSpace((spaceRow as Space | null) ?? null);
        }
      }
      if (active) setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [mode, params.id, params.username, params.slug]);

  if (loading) {
    return (
      <div className="space-app flex min-h-screen items-center justify-center">
        <p style={{ color: "var(--space-fg-muted)" }}>로딩...</p>
      </div>
    );
  }
  if (error) {
    return (
      <div className="space-app flex min-h-screen items-center justify-center">
        <p className="text-red-600">{error}</p>
      </div>
    );
  }
  if (!space) {
    return (
      <div className="space-app flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h1
            className="text-xl font-bold"
            style={{ color: "var(--space-accent)" }}
          >
            공간을 찾을 수 없어요
          </h1>
          <Link
            to="/"
            className="mt-4 inline-block text-sm hover:underline"
            style={{ color: "var(--space-fg-muted)" }}
          >
            홈으로
          </Link>
        </div>
      </div>
    );
  }

  const isOwner = !!user && space.author_id === user.id;

  if (mode === "public" && !space.published && !isOwner) {
    return (
      <div className="space-app flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h1
            className="text-xl font-bold"
            style={{ color: "var(--space-accent)" }}
          >
            비공개 공간이에요
          </h1>
          {profile && (
            <Link
              to={`/u/${profile.username}`}
              className="mt-4 inline-block text-sm hover:underline"
              style={{ color: "var(--space-fg-muted)" }}
            >
              {profile.display_name}님의 블로그로 →
            </Link>
          )}
        </div>
      </div>
    );
  }

  if (mode === "owner" && !isOwner) {
    // 본인 공간이 아닌데 owner 라우트로 들어온 경우 → 공개 라우트로 보내기
    return (
      <div className="space-app flex min-h-screen items-center justify-center">
        <p style={{ color: "var(--space-fg-muted)" }}>
          이 공간을 편집할 권한이 없어요.
        </p>
      </div>
    );
  }

  const base =
    mode === "owner"
      ? `/spaces/${space.id}`
      : `/u/${profile!.username}/spaces/${space.slug}`;

  return (
    <SpaceProvider space={space} isOwner={isOwner}>
      <SpaceShell
        space={space}
        base={base}
        profile={profile}
        isOwner={isOwner}
      >
        <Outlet />
      </SpaceShell>
    </SpaceProvider>
  );
}
