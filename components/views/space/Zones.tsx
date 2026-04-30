"use client";

import { useEffect, useState } from "react";
import { supabase, type Zone } from "@/lib/supabase";
import { useSpace } from "@/components/space/SpaceContext";

const ECOSYSTEM_OPTIONS = [
  "기본", "신성림", "수생", "정원", "농경", "마법숲", "사막", "동굴", "설원",
];
const ICON_OPTIONS = [
  "🌳", "💧", "🏡", "🌿", "🦊", "🌸", "🍄", "🔥", "❄️", "🌙", "⚡", "🪨",
];

export default function SpaceZonesView() {
  const { space, isOwner } = useSpace();
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    description: "",
    ecosystem_type: "기본",
    climate: "온화",
    color: "#4ade80",
    icon: "🌿",
  });

  useEffect(() => {
    fetchZones();
  }, [space.id]);

  async function fetchZones() {
    const { data } = await supabase()
      .from("zones")
      .select("*")
      .eq("space_id", space.id)
      .order("created_at");
    setZones((data ?? []) as Zone[]);
    setLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const sb = supabase();
    if (editingId) {
      await sb.from("zones").update(form).eq("id", editingId);
    } else {
      await sb.from("zones").insert({
        ...form,
        space_id: space.id,
        auto_feed: true,
        auto_environment: true,
        creature_count: 0,
        plant_count: 0,
      });
    }
    resetForm();
    fetchZones();
  }

  async function handleDelete(id: string) {
    if (!confirm("이 구역을 삭제하시겠습니까?")) return;
    await supabase().from("zones").delete().eq("id", id);
    fetchZones();
  }

  function startEdit(zone: Zone) {
    setForm({
      name: zone.name,
      description: zone.description ?? "",
      ecosystem_type: zone.ecosystem_type,
      climate: zone.climate ?? "온화",
      color: zone.color,
      icon: zone.icon,
    });
    setEditingId(zone.id);
    setShowForm(true);
  }

  function resetForm() {
    setForm({
      name: "",
      description: "",
      ecosystem_type: "기본",
      climate: "온화",
      color: "#4ade80",
      icon: "🌿",
    });
    setEditingId(null);
    setShowForm(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <p style={{ color: "var(--space-fg-muted)" }}>로딩 중...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">🗺️ 구역 관리</h1>
          <p className="text-sm mt-1" style={{ color: "var(--space-fg-muted)" }}>
            정원 내부 구역을 관리하고 생태계를 설정합니다
          </p>
        </div>
        {isOwner && (
          <button
            onClick={() => {
              resetForm();
              setShowForm(!showForm);
            }}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white"
            style={{ background: "var(--space-accent)" }}
          >
            {showForm ? "취소" : "+ 구역 추가"}
          </button>
        )}
      </div>

      {showForm && isOwner && (
        <form
          onSubmit={handleSubmit}
          className="rounded-xl p-6 border mb-6 space-y-4"
          style={{
            background: "var(--space-card)",
            borderColor: "var(--space-border)",
          }}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="구역 이름">
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full rounded-lg px-3 py-2 text-sm border"
                style={{
                  background: "var(--space-bg)",
                  borderColor: "var(--space-border)",
                  color: "var(--space-fg)",
                }}
                required
              />
            </Field>
            <Field label="생태계 유형">
              <select
                value={form.ecosystem_type}
                onChange={(e) =>
                  setForm({ ...form, ecosystem_type: e.target.value })
                }
                className="w-full rounded-lg px-3 py-2 text-sm border"
                style={{
                  background: "var(--space-bg)",
                  borderColor: "var(--space-border)",
                  color: "var(--space-fg)",
                }}
              >
                {ECOSYSTEM_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="기후">
              <input
                type="text"
                value={form.climate}
                onChange={(e) => setForm({ ...form, climate: e.target.value })}
                className="w-full rounded-lg px-3 py-2 text-sm border"
                style={{
                  background: "var(--space-bg)",
                  borderColor: "var(--space-border)",
                  color: "var(--space-fg)",
                }}
              />
            </Field>
            <Field label="아이콘">
              <div className="flex gap-2 flex-wrap">
                {ICON_OPTIONS.map((icon) => (
                  <button
                    type="button"
                    key={icon}
                    onClick={() => setForm({ ...form, icon })}
                    className="text-xl p-1.5 rounded-lg"
                    style={
                      form.icon === icon
                        ? {
                            background: "var(--space-accent-soft)",
                            outline: "2px solid var(--space-accent)",
                          }
                        : {}
                    }
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="색상">
              <input
                type="color"
                value={form.color}
                onChange={(e) => setForm({ ...form, color: e.target.value })}
                className="h-10 w-20 rounded-lg cursor-pointer border"
                style={{ borderColor: "var(--space-border)" }}
              />
            </Field>
          </div>
          <Field label="설명">
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full rounded-lg px-3 py-2 text-sm h-20 resize-none border"
              style={{
                background: "var(--space-bg)",
                borderColor: "var(--space-border)",
                color: "var(--space-fg)",
              }}
            />
          </Field>
          <button
            type="submit"
            className="px-6 py-2 rounded-lg text-sm font-medium text-white"
            style={{ background: "var(--space-accent)" }}
          >
            {editingId ? "수정" : "추가"}
          </button>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {zones.map((zone) => (
          <div
            key={zone.id}
            className="card-hover rounded-xl p-5 border"
            style={{
              background: "var(--space-card)",
              borderColor: "var(--space-border)",
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{zone.icon}</span>
                <div>
                  <h3 className="font-semibold">{zone.name}</h3>
                  <p
                    className="text-xs"
                    style={{ color: "var(--space-fg-soft)" }}
                  >
                    {zone.ecosystem_type} · {zone.climate}
                  </p>
                </div>
              </div>
              <div
                className="w-3 h-3 rounded-full"
                style={{ background: zone.color }}
              />
            </div>
            {zone.description && (
              <p
                className="text-sm mb-3"
                style={{ color: "var(--space-fg-muted)" }}
              >
                {zone.description}
              </p>
            )}
            <div
              className="flex items-center gap-4 text-sm mb-4"
              style={{ color: "var(--space-fg-muted)" }}
            >
              <span>🌱 식물 {zone.plant_count}</span>
              <span>🦊 생물 {zone.creature_count}</span>
            </div>
            <div
              className="flex items-center gap-4 text-xs mb-3"
              style={{ color: "var(--space-fg-soft)" }}
            >
              <span>{zone.auto_feed ? "✅" : "❌"} 자동 먹이</span>
              <span>{zone.auto_environment ? "✅" : "❌"} 맞춤 환경</span>
            </div>
            {isOwner && (
              <div className="flex gap-2">
                <button
                  onClick={() => startEdit(zone)}
                  className="px-3 py-1 text-xs rounded"
                  style={{ background: "rgba(91,155,213,0.18)", color: "#5b9bd5" }}
                >
                  수정
                </button>
                <button
                  onClick={() => handleDelete(zone.id)}
                  className="px-3 py-1 text-xs rounded"
                  style={{ background: "rgba(229,91,91,0.15)", color: "#e55b5b" }}
                >
                  삭제
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {zones.length === 0 && (
        <div
          className="text-center py-16"
          style={{ color: "var(--space-fg-soft)" }}
        >
          <span className="text-4xl block mb-4">🗺️</span>
          <p>등록된 구역이 없습니다</p>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        className="block text-sm mb-1"
        style={{ color: "var(--space-fg-muted)" }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}
