"use client";

import { useEffect, useState } from "react";
import {
  supabase,
  type Zone,
  type Creature,
  type Grade,
  type CreatureType,
  type GrowthStage,
  type GrowthMode,
} from "@/lib/supabase";
import GradeBadge from "@/components/space/GradeBadge";
import { useSpace } from "@/components/space/SpaceContext";

const GRADES: Grade[] = ["F", "E", "D", "C", "B", "A", "S", "SS", "SSS", "Ex"];
const TYPES: { value: CreatureType; label: string; icon: string }[] = [
  { value: "plant", label: "식물", icon: "🌱" },
  { value: "animal", label: "동물", icon: "🦊" },
  { value: "spirit", label: "영체", icon: "✨" },
  { value: "other", label: "기타", icon: "🔮" },
];
const STAGES: { value: GrowthStage; label: string }[] = [
  { value: "seed", label: "씨앗" },
  { value: "sprout", label: "새싹" },
  { value: "growing", label: "성장 중" },
  { value: "mature", label: "성숙" },
  { value: "ex", label: "Ex급" },
];

export default function SpaceCreaturesView() {
  const { space, isOwner } = useSpace();
  const [creatures, setCreatures] = useState<Creature[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>("all");
  const [filterGrade, setFilterGrade] = useState<string>("all");
  const [form, setForm] = useState({
    name: "",
    type: "plant" as CreatureType,
    grade: "F" as Grade,
    zone_id: "",
    growth_stage: "seed" as GrowthStage,
    growth_mode: "stage1" as GrowthMode,
    description: "",
    auto_classified: true,
  });

  useEffect(() => {
    let active = true;
    Promise.all([
      supabase()
        .from("creatures")
        .select("*")
        .eq("space_id", space.id)
        .order("created_at", { ascending: false }),
      supabase()
        .from("zones")
        .select("id,name,icon,space_id")
        .eq("space_id", space.id),
    ]).then(([cRes, zRes]) => {
      if (!active) return;
      setCreatures((cRes.data ?? []) as Creature[]);
      setZones((zRes.data ?? []) as Zone[]);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [space.id]);

  async function fetchCreatures() {
    const { data } = await supabase()
      .from("creatures")
      .select("*")
      .eq("space_id", space.id)
      .order("created_at", { ascending: false });
    setCreatures((data ?? []) as Creature[]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = { ...form, zone_id: form.zone_id || null };
    const sb = supabase();
    if (editingId) {
      await sb.from("creatures").update(payload).eq("id", editingId);
    } else {
      await sb.from("creatures").insert({ ...payload, space_id: space.id });
    }
    resetForm();
    fetchCreatures();
  }

  async function handleDelete(id: string) {
    if (!confirm("삭제하시겠습니까?")) return;
    await supabase().from("creatures").delete().eq("id", id);
    fetchCreatures();
  }

  function startEdit(c: Creature) {
    setForm({
      name: c.name,
      type: c.type,
      grade: c.grade,
      zone_id: c.zone_id ?? "",
      growth_stage: c.growth_stage,
      growth_mode: c.growth_mode,
      description: c.description ?? "",
      auto_classified: c.auto_classified,
    });
    setEditingId(c.id);
    setShowForm(true);
  }

  function resetForm() {
    setForm({
      name: "",
      type: "plant",
      grade: "F",
      zone_id: "",
      growth_stage: "seed",
      growth_mode: "stage1",
      description: "",
      auto_classified: true,
    });
    setEditingId(null);
    setShowForm(false);
  }

  const filtered = creatures.filter((c) => {
    if (filterType !== "all" && c.type !== filterType) return false;
    if (filterGrade !== "all" && c.grade !== filterGrade) return false;
    return true;
  });
  const zoneOf = (id: string | null) => zones.find((z) => z.id === id);

  if (loading)
    return (
      <div className="flex items-center justify-center h-96">
        <p style={{ color: "var(--space-fg-muted)" }}>로딩 중...</p>
      </div>
    );

  const inputStyle = {
    background: "var(--space-bg)",
    borderColor: "var(--space-border)",
    color: "var(--space-fg)",
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">🌱 동식물 관리</h1>
          <p className="text-sm mt-1" style={{ color: "var(--space-fg-muted)" }}>
            정원 내 동식물 개체를 관리합니다
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
            {showForm ? "취소" : "+ 개체 추가"}
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label="이름">
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full rounded-lg px-3 py-2 text-sm border"
                style={inputStyle}
                required
              />
            </Field>
            <Field label="유형">
              <select
                value={form.type}
                onChange={(e) =>
                  setForm({ ...form, type: e.target.value as CreatureType })
                }
                className="w-full rounded-lg px-3 py-2 text-sm border"
                style={inputStyle}
              >
                {TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.icon} {t.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="등급">
              <select
                value={form.grade}
                onChange={(e) =>
                  setForm({ ...form, grade: e.target.value as Grade })
                }
                className="w-full rounded-lg px-3 py-2 text-sm border"
                style={inputStyle}
              >
                {GRADES.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="구역">
              <select
                value={form.zone_id}
                onChange={(e) => setForm({ ...form, zone_id: e.target.value })}
                className="w-full rounded-lg px-3 py-2 text-sm border"
                style={inputStyle}
              >
                <option value="">미배정</option>
                {zones.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.icon} {z.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="성장 단계">
              <select
                value={form.growth_stage}
                onChange={(e) =>
                  setForm({
                    ...form,
                    growth_stage: e.target.value as GrowthStage,
                  })
                }
                className="w-full rounded-lg px-3 py-2 text-sm border"
                style={inputStyle}
              >
                {STAGES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="성장 모드">
              <select
                value={form.growth_mode}
                onChange={(e) =>
                  setForm({
                    ...form,
                    growth_mode: e.target.value as GrowthMode,
                  })
                }
                className="w-full rounded-lg px-3 py-2 text-sm border"
                style={inputStyle}
              >
                <option value="off">OFF</option>
                <option value="stage1">1단계 (2배속)</option>
                <option value="stage2">2단계 (즉시)</option>
              </select>
            </Field>
          </div>
          <Field label="설명">
            <textarea
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              className="w-full rounded-lg px-3 py-2 text-sm h-20 resize-none border"
              style={inputStyle}
            />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.auto_classified}
              onChange={(e) =>
                setForm({ ...form, auto_classified: e.target.checked })
              }
            />
            <span style={{ color: "var(--space-fg-muted)" }}>
              자동 분류 활성
            </span>
          </label>
          <button
            type="submit"
            className="px-6 py-2 rounded-lg text-sm font-medium text-white"
            style={{ background: "var(--space-accent)" }}
          >
            {editingId ? "수정" : "추가"}
          </button>
        </form>
      )}

      <div className="flex gap-3 mb-6">
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="rounded-lg px-3 py-2 text-sm border"
          style={{
            background: "var(--space-card)",
            borderColor: "var(--space-border)",
            color: "var(--space-fg)",
          }}
        >
          <option value="all">전체 유형</option>
          {TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.icon} {t.label}
            </option>
          ))}
        </select>
        <select
          value={filterGrade}
          onChange={(e) => setFilterGrade(e.target.value)}
          className="rounded-lg px-3 py-2 text-sm border"
          style={{
            background: "var(--space-card)",
            borderColor: "var(--space-border)",
            color: "var(--space-fg)",
          }}
        >
          <option value="all">전체 등급</option>
          {GRADES.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
        <span
          className="text-sm self-center"
          style={{ color: "var(--space-fg-soft)" }}
        >
          {filtered.length}개 표시
        </span>
      </div>

      <div
        className="rounded-xl border overflow-hidden"
        style={{
          background: "var(--space-card)",
          borderColor: "var(--space-border)",
        }}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr
                style={{
                  color: "var(--space-fg-muted)",
                  background: "var(--space-bg)",
                }}
              >
                <th className="text-left py-3 px-4">이름</th>
                <th className="text-left py-3 px-4">유형</th>
                <th className="text-left py-3 px-4">등급</th>
                <th className="text-left py-3 px-4">구역</th>
                <th className="text-left py-3 px-4">성장</th>
                <th className="text-left py-3 px-4">분류</th>
                {isOwner && <th className="text-left py-3 px-4">관리</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => {
                const zone = zoneOf(c.zone_id);
                const typeInfo = TYPES.find((t) => t.value === c.type);
                const stageInfo = STAGES.find(
                  (s) => s.value === c.growth_stage
                );
                return (
                  <tr
                    key={c.id}
                    className="border-t"
                    style={{ borderColor: "var(--space-border)" }}
                  >
                    <td className="py-3 px-4 font-medium">{c.name}</td>
                    <td className="py-3 px-4">
                      {typeInfo?.icon} {typeInfo?.label}
                    </td>
                    <td className="py-3 px-4">
                      <GradeBadge grade={c.grade} />
                    </td>
                    <td
                      className="py-3 px-4"
                      style={{ color: "var(--space-fg-muted)" }}
                    >
                      {zone ? `${zone.icon} ${zone.name}` : "미배정"}
                    </td>
                    <td
                      className="py-3 px-4"
                      style={{ color: "var(--space-fg-muted)" }}
                    >
                      {stageInfo?.label}
                    </td>
                    <td className="py-3 px-4">
                      {c.auto_classified ? "✅" : "❌"}
                    </td>
                    {isOwner && (
                      <td className="py-3 px-4">
                        <div className="flex gap-2">
                          <button
                            onClick={() => startEdit(c)}
                            className="px-2 py-1 text-xs rounded"
                            style={{
                              background: "rgba(91,155,213,0.18)",
                              color: "#5b9bd5",
                            }}
                          >
                            수정
                          </button>
                          <button
                            onClick={() => handleDelete(c.id)}
                            className="px-2 py-1 text-xs rounded"
                            style={{
                              background: "rgba(229,91,91,0.15)",
                              color: "#e55b5b",
                            }}
                          >
                            삭제
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div
            className="text-center py-16"
            style={{ color: "var(--space-fg-soft)" }}
          >
            <span className="text-4xl block mb-4">🌱</span>
            <p>등록된 동식물이 없습니다</p>
          </div>
        )}
      </div>
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
