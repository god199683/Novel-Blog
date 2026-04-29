"use client";

import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  supabase,
  type NovelMap,
  type Profile,
  type MapData,
} from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import MapEditor from "@/components/MapEditor";

const EMPTY_DATA: MapData = { pins: [], rects: [], lines: [] };

export default function UserMapView() {
  const { username, id } = useParams<{ username: string; id: string }>();
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [map, setMap] = useState<NovelMap | null>(null);
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

      const { data: mapRow } = await sb
        .from("maps")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (!active) return;
      if (!mapRow) {
        setNotFound(true);
      } else {
        setMap(mapRow as NovelMap);
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [username, id]);

  if (loading) return <p className="py-10 text-center text-slate-500">불러오는 중...</p>;
  if (notFound)
    return (
      <div className="mx-auto max-w-md py-20 text-center">
        <h1 className="text-2xl font-bold text-slate-900">지도를 찾을 수 없어요</h1>
        <Link to="/" className="mt-6 inline-block text-sm text-brand hover:underline">
          홈으로
        </Link>
      </div>
    );
  if (!profile || !map) return null;

  const isOwner = !!user && user.id === profile.id;
  if (!map.published && !isOwner) {
    return (
      <div className="mx-auto max-w-md py-20 text-center">
        <h1 className="text-xl font-bold text-slate-900">비공개 지도예요</h1>
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
    <article className="mx-auto max-w-5xl">
      <header className="mb-4 border-b border-sky-100 pb-4">
        <h1 className="text-2xl font-bold leading-snug text-slate-900">
          🗺️ {map.title}
        </h1>
        <div className="mt-2 flex items-center justify-between text-sm">
          <Link
            to={`/u/${profile.username}`}
            className="text-slate-700 hover:text-brand"
          >
            {profile.display_name}{" "}
            <span className="text-slate-400">@{profile.username}</span>
          </Link>
          {isOwner && (
            <Link
              to={`/maps/edit/${map.id}`}
              className="rounded-full border border-sky-200 px-3 py-1 text-xs text-slate-700 hover:border-brand hover:text-brand"
            >
              수정
            </Link>
          )}
        </div>
      </header>
      <MapEditor
        initialTitle={map.title}
        initialData={map.data ?? EMPTY_DATA}
        initialWidth={map.width}
        initialHeight={map.height}
        initialBackground={map.background_color}
        initialPublished={map.published}
        readOnly
      />
    </article>
  );
}
