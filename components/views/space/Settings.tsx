"use client";

import { useEffect, useState } from "react";
import { supabase, type GardenSetting } from "@/lib/supabase";
import ToggleSwitch from "@/components/space/ToggleSwitch";
import { useSpace } from "@/components/space/SpaceContext";

export default function SpaceSettingsView() {
  const { space, isOwner } = useSpace();
  const [settings, setSettings] = useState<GardenSetting[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase()
        .from("garden_settings")
        .select("*")
        .eq("space_id", space.id);
      if (!active) return;
      setSettings((data ?? []) as GardenSetting[]);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [space.id]);

  async function updateSetting(key: string, value: string) {
    if (!isOwner) return;
    // 1) 즉시 로컬 갱신 (낙관적) — 토글이 즉시 반응함
    const before = settings;
    const exists = before.some((s) => s.key === key);
    setSettings((prev) =>
      exists
        ? prev.map((s) => (s.key === key ? { ...s, value } : s))
        : [
            ...prev,
            {
              id: `tmp-${key}`,
              space_id: space.id,
              key,
              value,
              description: null,
              updated_at: new Date().toISOString(),
            },
          ]
    );
    // 2) DB 반영 — 행이 없을 수도 있어서 update 후 영향 행 0개면 insert
    const sb = supabase();
    const { data: updated, error: upErr } = await sb
      .from("garden_settings")
      .update({ value })
      .eq("space_id", space.id)
      .eq("key", key)
      .select();
    if (upErr) {
      alert(`설정 저장 실패: ${upErr.message}`);
      setSettings(before);
      return;
    }
    if (!updated || updated.length === 0) {
      const { error: insErr } = await sb
        .from("garden_settings")
        .insert({ space_id: space.id, key, value });
      if (insErr) {
        alert(`설정 저장 실패: ${insErr.message}`);
        setSettings(before);
      }
    }
  }
  const get = (key: string) =>
    settings.find((s) => s.key === key)?.value ?? "";
  const growthMode = get("growth_mode");

  if (loading)
    return (
      <div className="flex items-center justify-center h-96">
        <p style={{ color: "var(--space-fg-muted)" }}>로딩 중...</p>
      </div>
    );

  const cardStyle = {
    background: "var(--space-card)",
    borderColor: "var(--space-border)",
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold">⚙️ 시스템 설정</h1>
        <p className="text-sm mt-1" style={{ color: "var(--space-fg-muted)" }}>
          정원 관리 시스템의 전역 설정을 관리합니다
        </p>
        <p className="text-xs mt-2" style={{ color: "#e8a63a" }}>
          ※ 소유주와 파트너, 펫, 손님에게는 시스템 영향 없음
        </p>
      </div>

      <div
        className="rounded-xl p-6 border mb-6"
        style={cardStyle}
      >
        <h2 className="text-lg font-semibold mb-4">🌱 성장 시스템</h2>
        <div
          className="space-y-1 border-b pb-4 mb-4"
          style={{ borderColor: "var(--space-border)" }}
        >
          <ToggleSwitch
            active={get("infinite_growth") === "true"}
            onChange={(v) =>
              updateSetting("infinite_growth", v ? "true" : "false")
            }
            disabled={!isOwner}
            label="무한 재배 및 성장"
            description="기본 On — Ex급 도달 시 성장 자동 정지"
          />
        </div>
        <p className="text-sm font-medium mb-3">성장 단계 설정</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            { value: "off", label: "OFF", desc: "성장 비활성화", icon: "⏸️" },
            {
              value: "stage1",
              label: "1단계",
              desc: "기본 성장 속도 2배",
              icon: "⏩",
            },
            { value: "stage2", label: "2단계", desc: "즉시 성장", icon: "⚡" },
          ].map((opt) => {
            const active = growthMode === opt.value;
            return (
              <button
                key={opt.value}
                disabled={!isOwner}
                onClick={() => updateSetting("growth_mode", opt.value)}
                className="p-4 rounded-lg border text-left transition-all"
                style={
                  active
                    ? {
                        borderColor: "var(--space-accent)",
                        background: "var(--space-accent-soft)",
                        outline: "2px solid var(--space-accent)",
                      }
                    : { borderColor: "var(--space-border)" }
                }
              >
                <span className="text-xl block mb-2">{opt.icon}</span>
                <p className="text-sm font-semibold">{opt.label}</p>
                <p
                  className="text-xs mt-1"
                  style={{ color: "var(--space-fg-muted)" }}
                >
                  {opt.desc}
                </p>
              </button>
            );
          })}
        </div>
        <p
          className="text-xs mt-3"
          style={{ color: "var(--space-fg-soft)" }}
        >
          ※ Ex급으로 성장 시 성장 멈춤
        </p>
      </div>

      <div className="rounded-xl p-6 border mb-6" style={cardStyle}>
        <h2 className="text-lg font-semibold mb-4">🛡️ 환경 보호</h2>
        <ToggleSwitch
          active={get("pollution_shield") === "true"}
          onChange={(v) =>
            updateSetting("pollution_shield", v ? "true" : "false")
          }
          disabled={!isOwner}
          label="오염 방지 마법"
          description="동식물과 내부 건물, 시설 모두 포함"
        />
        <ToggleSwitch
          active={get("self_cleaning") === "true"}
          onChange={(v) =>
            updateSetting("self_cleaning", v ? "true" : "false")
          }
          disabled={!isOwner}
          label="자가 세척 마법"
          description="상시 발동 — 동식물과 내부 건물, 시설 모두 포함"
        />
      </div>

      <div className="rounded-xl p-6 border" style={cardStyle}>
        <h2 className="text-lg font-semibold mb-4">🤖 자동화</h2>
        <ToggleSwitch
          active={get("auto_classify") === "true"}
          onChange={(v) =>
            updateSetting("auto_classify", v ? "true" : "false")
          }
          disabled={!isOwner}
          label="동식물 자동 분류"
          description="개체/쓰임새에 따라 자동으로 분류 및 구역 분리"
        />
        <ToggleSwitch
          active={get("auto_environment") === "true"}
          onChange={(v) =>
            updateSetting("auto_environment", v ? "true" : "false")
          }
          disabled={!isOwner}
          label="맞춤 환경 자동 제공"
          description="구역별 최적 환경을 자동으로 조절"
        />
        <ToggleSwitch
          active={get("auto_feed") === "true"}
          onChange={(v) =>
            updateSetting("auto_feed", v ? "true" : "false")
          }
          disabled={!isOwner}
          label="먹이 자동 제공"
          description="동물 개체에게 적합한 먹이를 자동 공급"
        />
      </div>
    </div>
  );
}
