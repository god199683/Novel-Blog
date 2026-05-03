"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase, type Byproduct, type Creature } from "@/lib/supabase";
import { useSpace } from "@/components/space/SpaceContext";

type Item = Byproduct & { creature_ids: string[] };

export default function SpaceByproductsView() {
  const { space, isOwner } = useSpace();
  const [items, setItems] = useState<Item[]>([]);
  const [creatures, setCreatures] = useState<Creature[]>([]);
  const [loading, setLoading] = useState(true);

  // 폼 상태
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [selectedCreatureIds, setSelectedCreatureIds] = useState<Set<string>>(
    new Set()
  );
  const [creatureQuery, setCreatureQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const sb = supabase();
      const [bRes, cRes] = await Promise.all([
        sb
          .from("byproducts")
          .select("*")
          .eq("space_id", space.id)
          .order("created_at", { ascending: false }),
        sb
          .from("creatures")
          .select("*")
          .eq("space_id", space.id)
          .order("name"),
      ]);
      if (!active) return;
      const byproductRows = (bRes.data ?? []) as Byproduct[];
      const creatureRows = (cRes.data ?? []) as Creature[];
      setCreatures(creatureRows);

      // 연결 테이블에서 byproduct_id → creature_ids[]
      const ids = byproductRows.map((b) => b.id);
      let linkRows: { byproduct_id: string; creature_id: string }[] = [];
      if (ids.length > 0) {
        const { data: links } = await sb
          .from("byproduct_creatures")
          .select("byproduct_id,creature_id")
          .in("byproduct_id", ids);
        linkRows = links ?? [];
      }
      const byBp = new Map<string, string[]>();
      for (const l of linkRows) {
        if (!byBp.has(l.byproduct_id)) byBp.set(l.byproduct_id, []);
        byBp.get(l.byproduct_id)!.push(l.creature_id);
      }
      if (!active) return;
      setItems(
        byproductRows.map((b) => ({
          ...b,
          creature_ids: byBp.get(b.id) ?? [],
        }))
      );
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [space.id]);

  const creatureMap = useMemo(() => {
    const m = new Map<string, Creature>();
    for (const c of creatures) m.set(c.id, c);
    return m;
  }, [creatures]);

  const filteredCreatures = useMemo(() => {
    const q = creatureQuery.trim();
    if (!q) return creatures;
    return creatures.filter((c) =>
      c.name.toLowerCase().includes(q.toLowerCase())
    );
  }, [creatures, creatureQuery]);

  const resetForm = () => {
    setName("");
    setSelectedCreatureIds(new Set());
    setCreatureQuery("");
    setEditingId(null);
    setError(null);
  };

  const startNew = () => {
    resetForm();
    setShowForm(true);
  };

  const startEdit = (item: Item) => {
    setName(item.name);
    setSelectedCreatureIds(new Set(item.creature_ids));
    setEditingId(item.id);
    setShowForm(true);
    setError(null);
  };

  const cancel = () => {
    resetForm();
    setShowForm(false);
  };

  const toggleCreature = (id: string) => {
    setSelectedCreatureIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const save = async () => {
    if (!name.trim()) {
      setError("이름을 입력해 주세요");
      return;
    }
    setSaving(true);
    setError(null);
    const sb = supabase();
    const ids = Array.from(selectedCreatureIds);

    if (editingId) {
      // 이름 갱신
      const { error: upErr } = await sb
        .from("byproducts")
        .update({ name: name.trim() })
        .eq("id", editingId);
      if (upErr) {
        setSaving(false);
        setError(upErr.message);
        return;
      }
      // 연결 동기화 — 전체 삭제 후 재삽입 (간단/안전)
      await sb
        .from("byproduct_creatures")
        .delete()
        .eq("byproduct_id", editingId);
      if (ids.length > 0) {
        const rows = ids.map((cid) => ({
          byproduct_id: editingId,
          creature_id: cid,
        }));
        const { error: linkErr } = await sb
          .from("byproduct_creatures")
          .insert(rows);
        if (linkErr) {
          setSaving(false);
          setError(linkErr.message);
          return;
        }
      }
      setItems((cur) =>
        cur.map((it) =>
          it.id === editingId
            ? { ...it, name: name.trim(), creature_ids: ids }
            : it
        )
      );
    } else {
      // 새로 만들기 — name 외 컬럼은 기본값 사용
      const { data, error: insErr } = await sb
        .from("byproducts")
        .insert({
          space_id: space.id,
          name: name.trim(),
        })
        .select()
        .single();
      if (insErr || !data) {
        setSaving(false);
        setError(insErr?.message ?? "저장 실패");
        return;
      }
      const created = data as Byproduct;
      if (ids.length > 0) {
        const rows = ids.map((cid) => ({
          byproduct_id: created.id,
          creature_id: cid,
        }));
        const { error: linkErr } = await sb
          .from("byproduct_creatures")
          .insert(rows);
        if (linkErr) {
          setSaving(false);
          setError(linkErr.message);
          return;
        }
      }
      setItems((cur) => [{ ...created, creature_ids: ids }, ...cur]);
    }

    setSaving(false);
    resetForm();
    setShowForm(false);
  };

  const remove = async (id: string) => {
    if (!confirm("이 부산물을 삭제할까요?")) return;
    const { error } = await supabase().from("byproducts").delete().eq("id", id);
    if (error) {
      alert(error.message);
      return;
    }
    setItems((cur) => cur.filter((it) => it.id !== id));
  };

  if (loading)
    return (
      <div className="flex items-center justify-center h-96">
        <p style={{ color: "var(--space-fg-muted)" }}>로딩 중...</p>
      </div>
    );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">💎 부산물/채집품</h1>
          <p
            className="text-sm mt-1"
            style={{ color: "var(--space-fg-muted)" }}
          >
            등록된 동식물에서 얻을 수 있는 부산물·채집품
          </p>
        </div>
        {isOwner && !showForm && (
          <button
            onClick={startNew}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white"
            style={{ background: "var(--space-accent)" }}
          >
            + 새 부산물
          </button>
        )}
      </div>

      {/* 입력 폼 */}
      {isOwner && showForm && (
        <div
          className="rounded-xl p-6 border mb-6 space-y-4"
          style={{
            background: "var(--space-card)",
            borderColor: "var(--space-border)",
          }}
        >
          <h2 className="text-lg font-semibold">
            {editingId ? "부산물 수정" : "새 부산물 추가"}
          </h2>

          <div>
            <label
              className="block text-xs mb-1"
              style={{ color: "var(--space-fg-muted)" }}
            >
              이름
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              placeholder="예: 세계수의 잎"
              className="w-full rounded border px-3 py-2 text-sm"
              style={{
                background: "var(--space-bg)",
                borderColor: "var(--space-border)",
                color: "var(--space-fg)",
              }}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label
                className="text-xs"
                style={{ color: "var(--space-fg-muted)" }}
              >
                연결된 동식물 ({selectedCreatureIds.size}개 선택)
              </label>
              <input
                type="text"
                value={creatureQuery}
                onChange={(e) => setCreatureQuery(e.target.value)}
                placeholder="이름으로 찾기"
                className="rounded border px-2 py-1 text-xs w-40"
                style={{
                  background: "var(--space-bg)",
                  borderColor: "var(--space-border)",
                  color: "var(--space-fg)",
                }}
              />
            </div>
            {creatures.length === 0 ? (
              <p
                className="text-xs py-3 px-2"
                style={{ color: "var(--space-fg-soft)" }}
              >
                먼저 <strong>동식물 관리</strong>에서 동식물을 등록해 주세요.
              </p>
            ) : (
              <div
                className="rounded border max-h-72 overflow-auto"
                style={{
                  borderColor: "var(--space-border)",
                  background: "var(--space-bg)",
                }}
              >
                {filteredCreatures.length === 0 ? (
                  <p
                    className="text-xs px-3 py-3"
                    style={{ color: "var(--space-fg-soft)" }}
                  >
                    검색 결과가 없어요
                  </p>
                ) : (
                  <ul>
                    {filteredCreatures.map((c) => {
                      const checked = selectedCreatureIds.has(c.id);
                      return (
                        <li
                          key={c.id}
                          className="border-b last:border-b-0"
                          style={{ borderColor: "var(--space-border)" }}
                        >
                          <label
                            className="flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors"
                            style={
                              checked
                                ? { background: "var(--space-accent-soft)" }
                                : {}
                            }
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleCreature(c.id)}
                              className="h-4 w-4"
                              style={{ accentColor: "var(--space-accent)" }}
                            />
                            <span
                              className="text-sm"
                              style={{ color: "var(--space-fg)" }}
                            >
                              {c.type === "plant"
                                ? "🌱"
                                : c.type === "animal"
                                  ? "🦊"
                                  : c.type === "spirit"
                                    ? "✨"
                                    : "🔮"}{" "}
                              {c.name}
                            </span>
                            <span
                              className="ml-auto text-xs"
                              style={{ color: "var(--space-fg-soft)" }}
                            >
                              {c.grade}급
                            </span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-2">
            <button
              onClick={cancel}
              disabled={saving}
              className="px-4 py-2 rounded-lg text-sm border"
              style={{
                borderColor: "var(--space-border)",
                color: "var(--space-fg-muted)",
              }}
            >
              취소
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="px-5 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
              style={{ background: "var(--space-accent)" }}
            >
              {saving ? "저장 중..." : "저장"}
            </button>
          </div>
        </div>
      )}

      {/* 목록 */}
      {items.length === 0 ? (
        <div
          className="rounded-xl border border-dashed p-10 text-center text-sm"
          style={{
            borderColor: "var(--space-border)",
            color: "var(--space-fg-muted)",
          }}
        >
          아직 등록된 부산물이 없어요.
          {isOwner && " 위의 '+ 새 부산물'로 추가하세요."}
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li
              key={item.id}
              className="rounded-xl border p-5 card-hover"
              style={{
                background: "var(--space-card)",
                borderColor: "var(--space-border)",
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    💎 {item.name}
                  </h3>
                  {item.creature_ids.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {item.creature_ids.map((cid) => {
                        const c = creatureMap.get(cid);
                        if (!c)
                          return (
                            <span
                              key={cid}
                              className="rounded-full px-2 py-1 text-xs"
                              style={{
                                background: "var(--space-bg)",
                                color: "var(--space-fg-soft)",
                              }}
                            >
                              (삭제된 개체)
                            </span>
                          );
                        return (
                          <span
                            key={cid}
                            className="rounded-full px-2.5 py-1 text-xs"
                            style={{
                              background: "var(--space-accent-soft)",
                              color: "var(--space-accent-dim)",
                            }}
                          >
                            {c.type === "plant"
                              ? "🌱"
                              : c.type === "animal"
                                ? "🦊"
                                : c.type === "spirit"
                                  ? "✨"
                                  : "🔮"}{" "}
                            {c.name}
                          </span>
                        );
                      })}
                    </div>
                  ) : (
                    <p
                      className="mt-2 text-xs"
                      style={{ color: "var(--space-fg-soft)" }}
                    >
                      연결된 동식물 없음
                    </p>
                  )}
                </div>
                {isOwner && (
                  <div className="flex flex-col gap-1">
                    <button
                      onClick={() => startEdit(item)}
                      className="rounded px-3 py-1 text-xs border"
                      style={{
                        borderColor: "var(--space-border)",
                        color: "var(--space-fg-muted)",
                      }}
                    >
                      수정
                    </button>
                    <button
                      onClick={() => remove(item.id)}
                      className="rounded px-3 py-1 text-xs"
                      style={{
                        color: "#e55b5b",
                      }}
                    >
                      삭제
                    </button>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
