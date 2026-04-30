"use client";

import { useEffect, useState } from "react";
import {
  supabase,
  type Zone,
  type Creature,
  type GardenSetting,
} from "@/lib/supabase";
import StatCard from "@/components/space/StatCard";
import GradeBadge from "@/components/space/GradeBadge";
import { useSpace } from "@/components/space/SpaceContext";

export default function SpaceDashboardView() {
  const { space } = useSpace();
  const [zones, setZones] = useState<Zone[]>([]);
  const [creatures, setCreatures] = useState<Creature[]>([]);
  const [settings, setSettings] = useState<GardenSetting[]>([]);
  const [byproductCount, setByproductCount] = useState(0);
  const [accessCount, setAccessCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const sb = supabase();
      const [zonesRes, creaturesRes, settingsRes, byproductsRes, accessRes] =
        await Promise.all([
          sb.from("zones").select("*").eq("space_id", space.id),
          sb.from("creatures").select("*").eq("space_id", space.id),
          sb.from("garden_settings").select("*").eq("space_id", space.id),
          sb
            .from("byproducts")
            .select("id", { count: "exact" })
            .eq("space_id", space.id),
          sb
            .from("access_keys")
            .select("id", { count: "exact" })
            .eq("space_id", space.id),
        ]);
      if (!active) return;
      setZones((zonesRes.data ?? []) as Zone[]);
      setCreatures((creaturesRes.data ?? []) as Creature[]);
      setSettings((settingsRes.data ?? []) as GardenSetting[]);
      setByproductCount(byproductsRes.count ?? 0);
      setAccessCount(accessRes.count ?? 0);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [space.id]);

  const plants = creatures.filter((c) => c.type === "plant");
  const animals = creatures.filter((c) => c.type !== "plant");
  const exGrade = creatures.filter((c) => c.grade === "Ex");
  const growthSetting = settings.find((s) => s.key === "growth_mode");
  const pollutionShield = settings.find((s) => s.key === "pollution_shield");

  const growthLabel: Record<string, string> = {
    off: "OFF",
    stage1: "1단계 (2배속)",
    stage2: "2단계 (즉시)",
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <span className="text-4xl block mb-4">{space.icon}</span>
          <p style={{ color: "var(--space-fg-muted)" }}>
            데이터를 불러오는 중...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold">{space.title} 대시보드</h1>
        {space.description && (
          <p className="text-sm mt-1" style={{ color: "var(--space-fg-muted)" }}>
            {space.description}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard icon="🗺️" label="구역" value={zones.length} sub="활성 구역" />
        <StatCard icon="🌱" label="식물" value={plants.length} color="#16a34a" />
        <StatCard icon="🦊" label="생물" value={animals.length} color="#ea580c" />
        <StatCard
          icon="💎"
          label="부산물"
          value={byproductCount}
          color="#7c3aed"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div
          className="rounded-xl p-6 border"
          style={{
            background: "var(--space-card)",
            borderColor: "var(--space-border)",
          }}
        >
          <h2 className="text-lg font-semibold mb-4">⚙️ 시스템 상태</h2>
          <div className="space-y-3">
            <Row
              label="성장 모드"
              value={growthLabel[growthSetting?.value ?? "stage1"] ?? "—"}
              color="var(--space-accent)"
            />
            <Row
              label="오염 방지"
              value={
                pollutionShield?.value === "true" ? "✅ 활성" : "❌ 비활성"
              }
              color={
                pollutionShield?.value === "true"
                  ? "var(--space-accent)"
                  : "#e55b5b"
              }
            />
            <Row
              label="출입 패스키"
              value={`${accessCount}명 등록`}
              color="#5b9bd5"
            />
            <Row
              label="Ex급 개체"
              value={`${exGrade.length}개`}
              color="#e8a63a"
              last
            />
          </div>
        </div>

        <div
          className="rounded-xl p-6 border"
          style={{
            background: "var(--space-card)",
            borderColor: "var(--space-border)",
          }}
        >
          <h2 className="text-lg font-semibold mb-4">🗺️ 구역 현황</h2>
          <div className="space-y-2">
            {zones.map((zone) => (
              <div
                key={zone.id}
                className="flex items-center justify-between p-3 rounded-lg transition-colors"
                style={{ background: "var(--space-bg)" }}
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg">{zone.icon}</span>
                  <div>
                    <p className="text-sm font-medium">{zone.name}</p>
                    <p
                      className="text-xs"
                      style={{ color: "var(--space-fg-soft)" }}
                    >
                      {zone.ecosystem_type}
                    </p>
                  </div>
                </div>
                <div
                  className="flex items-center gap-4 text-xs"
                  style={{ color: "var(--space-fg-muted)" }}
                >
                  <span>🌱 {zone.plant_count}</span>
                  <span>🦊 {zone.creature_count}</span>
                </div>
              </div>
            ))}
            {zones.length === 0 && (
              <p
                className="text-sm text-center py-4"
                style={{ color: "var(--space-fg-soft)" }}
              >
                구역 데이터가 없습니다
              </p>
            )}
          </div>
        </div>
      </div>

      <div
        className="rounded-xl p-6 border"
        style={{
          background: "var(--space-card)",
          borderColor: "var(--space-border)",
        }}
      >
        <h2 className="text-lg font-semibold mb-4">🌿 최근 등록된 동식물</h2>
        {creatures.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ color: "var(--space-fg-muted)" }}>
                  <th className="text-left py-2 px-3">이름</th>
                  <th className="text-left py-2 px-3">유형</th>
                  <th className="text-left py-2 px-3">등급</th>
                  <th className="text-left py-2 px-3">성장 단계</th>
                </tr>
              </thead>
              <tbody>
                {creatures.slice(0, 10).map((c) => (
                  <tr
                    key={c.id}
                    className="border-t"
                    style={{ borderColor: "var(--space-border)" }}
                  >
                    <td className="py-2 px-3 font-medium">{c.name}</td>
                    <td
                      className="py-2 px-3"
                      style={{ color: "var(--space-fg-muted)" }}
                    >
                      {c.type === "plant"
                        ? "🌱 식물"
                        : c.type === "animal"
                          ? "🦊 동물"
                          : c.type === "spirit"
                            ? "✨ 영체"
                            : "🔮 기타"}
                    </td>
                    <td className="py-2 px-3">
                      <GradeBadge grade={c.grade} />
                    </td>
                    <td
                      className="py-2 px-3"
                      style={{ color: "var(--space-fg-muted)" }}
                    >
                      {c.growth_stage}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p
            className="text-sm text-center py-8"
            style={{ color: "var(--space-fg-soft)" }}
          >
            등록된 동식물이 없습니다.
          </p>
        )}
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  color,
  last,
}: {
  label: string;
  value: string;
  color?: string;
  last?: boolean;
}) {
  return (
    <div
      className={`flex justify-between items-center py-2 ${
        last ? "" : "border-b"
      }`}
      style={{ borderColor: "var(--space-border)" }}
    >
      <span className="text-sm" style={{ color: "var(--space-fg-muted)" }}>
        {label}
      </span>
      <span className="text-sm font-medium" style={{ color }}>
        {value}
      </span>
    </div>
  );
}
