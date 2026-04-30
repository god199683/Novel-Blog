"use client";

import { useEffect, useState } from "react";
import {
  supabase,
  type Byproduct,
  type Zone,
  type Creature,
  type Grade,
} from "@/lib/supabase";
import GradeBadge from "@/components/space/GradeBadge";
import { useSpace } from "@/components/space/SpaceContext";

const GRADES: Grade[] = ["F", "E", "D", "C", "B", "A", "S", "SS", "SSS", "Ex"];
const CATEGORIES = [
  "약재", "광물", "식재료", "마법재료", "영약", "씨앗", "가죽/깃털", "기타",
];

export default function SpaceByproductsView() {
  const { space, isOwner } = useSpace();
  const [items, setItems] = useState<Byproduct[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [creatures, setCreatures] = useState<Creature[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    source_creature_id: "",
    source_zone_id: "",
    grade: "F" as Grade,
    quantity: 1,
    category: "기타",
    description: "",
  });

  useEffect(() => {
    let active = true;
    Promise.all([
      supabase()
        .from("byproducts")
        .select("*")
        .eq("space_id", space.id)
        .order("grade", { ascending: false }),
      supabase()
        .from("zones")
        .select("id,name,icon,space_id")
        .eq("space_id", space.id),
      supabase()
        .from("creatures")
        .select("id,name,space_id")
        .eq("space_id", space.id),
    ]).then(([bRes, zRes, cRes]) => {
      if (!active) return;
      setItems((bRes.data ?? []) as Byproduct[]);
      setZones((zRes.data ?? []) as Zone[]);
      setCreatures((cRes.data ?? []) as Creature[]);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [space.id]);

  async function fetchItems() {
    const { data } = await supabase()
      .from("byproducts")
      .select("*")
      .eq("space_id", space.id)
      .order("grade", { ascending: false });
    setItems((data ?? []) as Byproduct[]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      ...form,
      source_creature_id: form.source_creature_id || null,
      source_zone_id: form.source_zone_id || null,
    };
    const sb = supabase();
    if (editingId) {
      await sb.from("byproducts").update(payload).eq("id", editingId);
    } else {
      await sb.from("byproducts").insert({ ...payload, space_id: space.id });
    }
    resetForm();
    fetchItems();
  }

  async function handleDelete(id: string) {
    if (!confirm("삭제하시겠습니까?")) return;
    await supabase().from("byproducts").delete().eq("id", id);
    fetchItems();
  }

  function startEdit(b: Byproduct) {
    setForm({
      name: b.name,
      source_creature_id: b.source_creature_id ?? "",
      source_zone_id: b.source_zone_id ?? "",
      grade: b.grade,
      quantity: b.quantity,
      category: b.category,
      description: b.description ?? "",
    });
    setEditingId(b.id);
    setShowForm(true);
  }

  function resetForm() {
    setForm({
      name: "",
      source_creature_id: "",
      source_zone_id: "",
      grade: "F",
      quantity: 1,
      category: "기타",
      description: "",
    });
    setEditingId(null);
    setShowForm(false);
  }

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
          <h1 className="text-2xl font-bold">💎 부산물 / 채집품</h1>
          <p className="text-sm mt-1" style={{ color: "var(--space-fg-muted)" }}>
            정원에서 얻은 부산물과 채집품 관리 (Ex급까지 등급 상승 가능)
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
            {showForm ? "취소" : "+ 아이템 추가"}
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
            <Field label="카테고리">
              <select
                value={form.category}
                onChange={(e) =>
                  setForm({ ...form, category: e.target.value })
                }
                className="w-full rounded-lg px-3 py-2 text-sm border"
                style={inputStyle}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
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
            <Field label="수량">
              <input
                type="number"
                min={0}
                value={form.quantity}
                onChange={(e) =>
                  setForm({
                    ...form,
                    quantity: parseInt(e.target.value, 10) || 0,
                  })
                }
                className="w-full rounded-lg px-3 py-2 text-sm border"
                style={inputStyle}
              />
            </Field>
            <Field label="원천 동식물">
              <select
                value={form.source_creature_id}
                onChange={(e) =>
                  setForm({ ...form, source_creature_id: e.target.value })
                }
                className="w-full rounded-lg px-3 py-2 text-sm border"
                style={inputStyle}
              >
                <option value="">없음</option>
                {creatures.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="원천 구역">
              <select
                value={form.source_zone_id}
                onChange={(e) =>
                  setForm({ ...form, source_zone_id: e.target.value })
                }
                className="w-full rounded-lg px-3 py-2 text-sm border"
                style={inputStyle}
              >
                <option value="">없음</option>
                {zones.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.icon} {z.name}
                  </option>
                ))}
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
          <button
            type="submit"
            className="px-6 py-2 rounded-lg text-sm font-medium text-white"
            style={{ background: "var(--space-accent)" }}
          >
            {editingId ? "수정" : "추가"}
          </button>
        </form>
      )}

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
                <th className="text-left py-3 px-4">카테고리</th>
                <th className="text-left py-3 px-4">등급</th>
                <th className="text-left py-3 px-4">수량</th>
                <th className="text-left py-3 px-4">원천</th>
                {isOwner && <th className="text-left py-3 px-4">관리</th>}
              </tr>
            </thead>
            <tbody>
              {items.map((b) => {
                const creature = creatures.find(
                  (c) => c.id === b.source_creature_id
                );
                const zone = zones.find((z) => z.id === b.source_zone_id);
                return (
                  <tr
                    key={b.id}
                    className="border-t"
                    style={{ borderColor: "var(--space-border)" }}
                  >
                    <td className="py-3 px-4 font-medium">{b.name}</td>
                    <td
                      className="py-3 px-4"
                      style={{ color: "var(--space-fg-muted)" }}
                    >
                      {b.category}
                    </td>
                    <td className="py-3 px-4">
                      <GradeBadge grade={b.grade} />
                    </td>
                    <td className="py-3 px-4">{b.quantity}</td>
                    <td
                      className="py-3 px-4 text-xs"
                      style={{ color: "var(--space-fg-muted)" }}
                    >
                      {creature && <span>{creature.name}</span>}
                      {creature && zone && <span> · </span>}
                      {zone && (
                        <span>
                          {zone.icon} {zone.name}
                        </span>
                      )}
                      {!creature && !zone && "-"}
                    </td>
                    {isOwner && (
                      <td className="py-3 px-4">
                        <div className="flex gap-2">
                          <button
                            onClick={() => startEdit(b)}
                            className="px-2 py-1 text-xs rounded"
                            style={{
                              background: "rgba(91,155,213,0.18)",
                              color: "#5b9bd5",
                            }}
                          >
                            수정
                          </button>
                          <button
                            onClick={() => handleDelete(b.id)}
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
        {items.length === 0 && (
          <div
            className="text-center py-16"
            style={{ color: "var(--space-fg-soft)" }}
          >
            <span className="text-4xl block mb-4">💎</span>
            <p>등록된 부산물이 없습니다</p>
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
