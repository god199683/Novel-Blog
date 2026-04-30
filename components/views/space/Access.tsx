"use client";

import { useEffect, useState } from "react";
import { supabase, type AccessKey, type AccessRole } from "@/lib/supabase";
import { useSpace } from "@/components/space/SpaceContext";

const ROLES: {
  value: AccessRole;
  label: string;
  icon: string;
  color: string;
}[] = [
  { value: "owner", label: "소유주", icon: "👑", color: "#e8a63a" },
  { value: "partner", label: "파트너", icon: "💫", color: "#8b7ec8" },
  { value: "family", label: "가족", icon: "🏠", color: "#e8a63a" },
  { value: "pet", label: "펫", icon: "🐾", color: "var(--space-accent)" },
  { value: "guest", label: "손님", icon: "🎫", color: "#5b9bd5" },
];

function defaultExpiry() {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().split("T")[0];
}

export default function SpaceAccessView() {
  const { space, isOwner } = useSpace();
  const [keys, setKeys] = useState<AccessKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    holder_name: "",
    role: "guest" as AccessRole,
    is_active: true,
    expires_at: defaultExpiry(),
  });

  useEffect(() => {
    fetchKeys();
  }, [space.id]);

  async function fetchKeys() {
    const { data } = await supabase()
      .from("access_keys")
      .select("*")
      .eq("space_id", space.id)
      .order("granted_at");
    setKeys((data ?? []) as AccessKey[]);
    setLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      ...form,
      expires_at: form.expires_at || null,
    };
    const sb = supabase();
    if (editingId) {
      await sb.from("access_keys").update(payload).eq("id", editingId);
    } else {
      await sb.from("access_keys").insert({ ...payload, space_id: space.id });
    }
    resetForm();
    fetchKeys();
  }

  async function toggleActive(id: string, current: boolean) {
    await supabase()
      .from("access_keys")
      .update({ is_active: !current })
      .eq("id", id);
    fetchKeys();
  }

  async function handleDelete(id: string) {
    if (!confirm("이 패스키를 삭제하시겠습니까?")) return;
    await supabase().from("access_keys").delete().eq("id", id);
    fetchKeys();
  }

  function startEdit(k: AccessKey) {
    setForm({
      holder_name: k.holder_name,
      role: k.role,
      is_active: k.is_active,
      expires_at: k.expires_at ? k.expires_at.split("T")[0] : "",
    });
    setEditingId(k.id);
    setShowForm(true);
  }

  function resetForm() {
    setForm({
      holder_name: "",
      role: "guest",
      is_active: true,
      expires_at: defaultExpiry(),
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

  const activeCount = keys.filter((k) => k.is_active).length;
  const inputStyle = {
    background: "var(--space-bg)",
    borderColor: "var(--space-border)",
    color: "var(--space-fg)",
  };
  const cardStyle = {
    background: "var(--space-card)",
    borderColor: "var(--space-border)",
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">🔑 출입 관리</h1>
          <p
            className="text-sm mt-1"
            style={{ color: "var(--space-fg-muted)" }}
          >
            소유주와 패스키 소유자들 외 출입 불가
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
            {showForm ? "취소" : "+ 패스키 발급"}
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        {ROLES.map((r) => {
          const count = keys.filter(
            (k) => k.role === r.value && k.is_active
          ).length;
          return (
            <div
              key={r.value}
              className="rounded-xl p-4 border text-center"
              style={cardStyle}
            >
              <span className="text-2xl block mb-2">{r.icon}</span>
              <p className="text-2xl font-bold" style={{ color: r.color }}>
                {count}
              </p>
              <p
                className="text-xs"
                style={{ color: "var(--space-fg-soft)" }}
              >
                {r.label}
              </p>
            </div>
          );
        })}
      </div>

      <p
        className="text-sm mb-4"
        style={{ color: "var(--space-fg-soft)" }}
      >
        활성 패스키: {activeCount} / 전체: {keys.length}
      </p>

      {showForm && isOwner && (
        <form
          onSubmit={handleSubmit}
          className="rounded-xl p-6 border mb-6 space-y-4"
          style={cardStyle}
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label="소유자 이름">
              <input
                type="text"
                value={form.holder_name}
                onChange={(e) =>
                  setForm({ ...form, holder_name: e.target.value })
                }
                className="w-full rounded-lg px-3 py-2 text-sm border"
                style={inputStyle}
                required
              />
            </Field>
            <Field label="역할">
              <select
                value={form.role}
                onChange={(e) => {
                  const role = e.target.value as AccessRole;
                  if (role === "guest") {
                    setForm({ ...form, role, expires_at: defaultExpiry() });
                  } else {
                    setForm({ ...form, role, expires_at: "" });
                  }
                }}
                className="w-full rounded-lg px-3 py-2 text-sm border"
                style={inputStyle}
              >
                {ROLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.icon} {r.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="만료일 (선택)">
              <input
                type="date"
                value={form.expires_at}
                onChange={(e) =>
                  setForm({ ...form, expires_at: e.target.value })
                }
                className="w-full rounded-lg px-3 py-2 text-sm border"
                style={inputStyle}
              />
            </Field>
          </div>
          <button
            type="submit"
            className="px-6 py-2 rounded-lg text-sm font-medium text-white"
            style={{ background: "var(--space-accent)" }}
          >
            {editingId ? "수정" : "발급"}
          </button>
        </form>
      )}

      <div className="space-y-3">
        {keys.map((k) => {
          const role = ROLES.find((r) => r.value === k.role)!;
          return (
            <div
              key={k.id}
              className="rounded-xl p-4 border flex items-center justify-between"
              style={{
                ...cardStyle,
                opacity: k.is_active ? 1 : 0.5,
              }}
            >
              <div className="flex items-center gap-4">
                <span className="text-2xl">{role.icon}</span>
                <div>
                  <p className="font-medium">{k.holder_name}</p>
                  <div
                    className="flex items-center gap-3 text-xs mt-1"
                    style={{ color: "var(--space-fg-soft)" }}
                  >
                    <span style={{ color: role.color }}>{role.label}</span>
                    <span>
                      발급:{" "}
                      {new Date(k.granted_at).toLocaleDateString("ko-KR")}
                    </span>
                    {k.expires_at && (
                      <span>
                        만료:{" "}
                        {new Date(k.expires_at).toLocaleDateString("ko-KR")}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              {isOwner && (
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => toggleActive(k.id, k.is_active)}
                    className="px-3 py-1 text-xs rounded"
                    style={
                      k.is_active
                        ? {
                            background: "var(--space-accent-soft)",
                            color: "var(--space-accent)",
                          }
                        : {
                            background: "rgba(229,91,91,0.15)",
                            color: "#e55b5b",
                          }
                    }
                  >
                    {k.is_active ? "활성" : "비활성"}
                  </button>
                  <button
                    onClick={() => startEdit(k)}
                    className="px-2 py-1 text-xs rounded"
                    style={{
                      background: "rgba(91,155,213,0.18)",
                      color: "#5b9bd5",
                    }}
                  >
                    수정
                  </button>
                  <button
                    onClick={() => handleDelete(k.id)}
                    className="px-2 py-1 text-xs rounded"
                    style={{
                      background: "rgba(229,91,91,0.15)",
                      color: "#e55b5b",
                    }}
                  >
                    삭제
                  </button>
                </div>
              )}
            </div>
          );
        })}
        {keys.length === 0 && (
          <div
            className="text-center py-16"
            style={{ color: "var(--space-fg-soft)" }}
          >
            <span className="text-4xl block mb-4">🔑</span>
            <p>등록된 패스키가 없습니다</p>
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
