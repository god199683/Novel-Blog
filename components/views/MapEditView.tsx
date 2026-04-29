"use client";

import { useEffect, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { supabase, type NovelMap, type MapData } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import MapEditor from "@/components/MapEditor";

const EMPTY_DATA: MapData = { pins: [], rects: [], lines: [] };

export default function MapEditView() {
  const { id } = useParams<{ id?: string }>();
  const isNew = !id;
  const nav = useNavigate();
  const { user, loading } = useAuth();

  const [map, setMap] = useState<NovelMap | null>(null);
  const [loadingMap, setLoadingMap] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isNew || !id) return;
    let active = true;
    (async () => {
      const { data, error } = await supabase()
        .from("maps")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (!active) return;
      if (error) setError(error.message);
      else setMap(data as NovelMap | null);
      setLoadingMap(false);
    })();
    return () => {
      active = false;
    };
  }, [id, isNew]);

  if (loading || loadingMap)
    return <p className="py-10 text-center text-slate-500">로딩...</p>;
  if (!user) return <Navigate to="/login" replace />;
  if (error) return <p className="py-10 text-center text-red-600">{error}</p>;
  if (!isNew && map && map.author_id !== user.id)
    return <Navigate to="/" replace />;

  const handleSave = async (payload: {
    title: string;
    data: MapData;
    width: number;
    height: number;
    background_color: string;
    published: boolean;
  }) => {
    setSaving(true);
    setError(null);
    const sb = supabase();
    if (isNew) {
      const { data, error } = await sb
        .from("maps")
        .insert({
          author_id: user.id,
          ...payload,
        })
        .select()
        .single();
      setSaving(false);
      if (error) {
        setError(error.message);
        return;
      }
      nav(`/maps/edit/${(data as { id: string }).id}`);
    } else if (id) {
      const { error } = await sb.from("maps").update(payload).eq("id", id);
      setSaving(false);
      if (error) {
        setError(error.message);
        return;
      }
      // 저장됐다는 표시는 굳이 추가 토스트 없이 성공으로 처리
      setMap((m) => (m ? { ...m, ...payload } : m));
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    if (!confirm("이 지도를 정말 삭제할까요?")) return;
    const { error } = await supabase().from("maps").delete().eq("id", id);
    if (error) {
      setError(error.message);
      return;
    }
    nav("/maps");
  };

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold text-slate-900">
        {isNew ? "새 지도 만들기" : "지도 수정"}
      </h1>
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      <MapEditor
        initialTitle={map?.title ?? ""}
        initialData={map?.data ?? EMPTY_DATA}
        initialWidth={map?.width ?? 1000}
        initialHeight={map?.height ?? 700}
        initialBackground={map?.background_color ?? "#f5edd8"}
        initialPublished={map?.published ?? true}
        saving={saving}
        onSave={handleSave}
        onDelete={isNew ? undefined : handleDelete}
      />
    </div>
  );
}
