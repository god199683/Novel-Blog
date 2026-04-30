"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase, type Zone } from "@/lib/supabase";
import { useSpace } from "@/components/space/SpaceContext";

type Pos = { x: number; y: number; w: number; h: number };

const DEFAULTS: Record<string, Pos> = {
  "세계수 주변": { x: 35, y: 28, w: 26, h: 26 },
  "호수 구역": { x: 28, y: 50, w: 28, h: 22 },
  "저택 정원": { x: 50, y: 5, w: 26, h: 22 },
  "약초 밭": { x: 5, y: 15, w: 18, h: 20 },
  "영수 서식지": { x: 60, y: 60, w: 20, h: 20 },
};

type DragMode = "move" | "resize-br";

export default function SpaceMapView() {
  const { space, isOwner } = useSpace();
  const [zones, setZones] = useState<Zone[]>([]);
  const [positions, setPositions] = useState<Record<string, Pos>>({});
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  const [dragging, setDragging] = useState<string | null>(null);
  const [dragMode, setDragMode] = useState<DragMode>("move");
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [dragStartPos, setDragStartPos] = useState<Pos>({ x: 0, y: 0, w: 0, h: 0 });
  const mapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const sb = supabase();
      const [zonesRes, settingRes] = await Promise.all([
        sb
          .from("zones")
          .select("*")
          .eq("space_id", space.id)
          .order("created_at"),
        sb
          .from("garden_settings")
          .select("*")
          .eq("space_id", space.id)
          .eq("key", "zone_positions")
          .maybeSingle(),
      ]);
      if (!active) return;
      const zs = (zonesRes.data ?? []) as Zone[];
      setZones(zs);

      let stored: Record<string, Pos> = {};
      if (settingRes.data?.value) {
        try {
          stored = JSON.parse(settingRes.data.value);
        } catch {}
      }
      const merged: Record<string, Pos> = {};
      zs.forEach((z, i) => {
        merged[z.name] =
          stored[z.name] ??
          DEFAULTS[z.name] ?? {
            x: 5 + (i % 4) * 22,
            y: 80,
            w: 16,
            h: 14,
          };
      });
      setPositions(merged);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [space.id]);

  const persist = useCallback(
    async (updated: Record<string, Pos>) => {
      await supabase()
        .from("garden_settings")
        .upsert(
          {
            space_id: space.id,
            key: "zone_positions",
            value: JSON.stringify(updated),
            description: "맵 구역 위치",
          },
          { onConflict: "space_id,key" }
        );
    },
    [space.id]
  );

  const onZoneMouseDown = (
    e: React.MouseEvent,
    zoneName: string,
    mode: DragMode
  ) => {
    if (!editMode || !isOwner || !mapRef.current) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = mapRef.current.getBoundingClientRect();
    setDragStart({
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    });
    setDragStartPos({ ...(positions[zoneName] ?? DEFAULTS[zoneName] ?? {x:0,y:0,w:16,h:14}) });
    setDragging(zoneName);
    setDragMode(mode);
    setSelected(zoneName);
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragging || !mapRef.current) return;
    const rect = mapRef.current.getBoundingClientRect();
    const mx = ((e.clientX - rect.left) / rect.width) * 100;
    const my = ((e.clientY - rect.top) / rect.height) * 100;
    const dx = mx - dragStart.x;
    const dy = my - dragStart.y;
    setPositions((prev) => {
      const cur = { ...dragStartPos };
      let next: Pos;
      if (dragMode === "move") {
        next = {
          ...cur,
          x: Math.max(0, Math.min(100 - cur.w, cur.x + dx)),
          y: Math.max(0, Math.min(100 - cur.h, cur.y + dy)),
        };
      } else {
        next = {
          ...cur,
          w: Math.max(8, Math.min(100 - cur.x, cur.w + dx)),
          h: Math.max(8, Math.min(100 - cur.y, cur.h + dy)),
        };
      }
      return { ...prev, [dragging]: next };
    });
  };

  const onMouseUp = () => {
    if (!dragging) return;
    setDragging(null);
    persist(positions);
  };

  const resetPositions = async () => {
    if (!confirm("기본 배치로 초기화할까요?")) return;
    const reset: Record<string, Pos> = {};
    zones.forEach((z, i) => {
      reset[z.name] =
        DEFAULTS[z.name] ?? {
          x: 5 + (i % 4) * 22,
          y: 80,
          w: 16,
          h: 14,
        };
    });
    setPositions(reset);
    await persist(reset);
  };

  if (loading)
    return (
      <div className="flex items-center justify-center h-96">
        <p style={{ color: "var(--space-fg-muted)" }}>로딩 중...</p>
      </div>
    );

  const selectedZone = selected ? zones.find((z) => z.name === selected) : null;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">🌍 정원 맵</h1>
          <p
            className="text-sm mt-1"
            style={{ color: "var(--space-fg-muted)" }}
          >
            구역의 위치와 크기를 시각적으로 배치합니다
          </p>
        </div>
        {isOwner && (
          <div className="flex gap-2">
            <button
              onClick={() => setEditMode((m) => !m)}
              className="px-4 py-2 rounded-lg text-sm font-medium text-white"
              style={{
                background: editMode ? "#e8a63a" : "var(--space-accent)",
              }}
            >
              {editMode ? "✓ 편집 종료" : "✎ 편집 모드"}
            </button>
            {editMode && (
              <button
                onClick={resetPositions}
                className="px-4 py-2 rounded-lg text-sm border"
                style={{
                  borderColor: "var(--space-border)",
                  color: "var(--space-fg-muted)",
                }}
              >
                기본 배치로
              </button>
            )}
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-[1fr_280px] gap-4">
        <div
          ref={mapRef}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          className="relative rounded-2xl border overflow-hidden"
          style={{
            background:
              "radial-gradient(ellipse at center, rgba(74,168,216,0.06) 0%, var(--space-card) 70%)",
            borderColor: "var(--space-border)",
            aspectRatio: "1 / 1",
            userSelect: dragging ? "none" : "auto",
          }}
        >
          {zones.map((z) => {
            const pos =
              positions[z.name] ??
              DEFAULTS[z.name] ?? { x: 0, y: 0, w: 16, h: 14 };
            const isSelected = selected === z.name;
            return (
              <div
                key={z.id}
                onMouseDown={(e) => onZoneMouseDown(e, z.name, "move")}
                onClick={() => setSelected(z.name)}
                className="absolute rounded-xl flex flex-col items-center justify-center text-center transition-shadow"
                style={{
                  left: `${pos.x}%`,
                  top: `${pos.y}%`,
                  width: `${pos.w}%`,
                  height: `${pos.h}%`,
                  background: `${z.color}33`,
                  borderColor: z.color,
                  borderWidth: 2,
                  borderStyle: "solid",
                  cursor: editMode ? "move" : "pointer",
                  boxShadow: isSelected
                    ? `0 0 0 3px ${z.color}66`
                    : "0 2px 8px rgba(74,168,216,0.1)",
                }}
              >
                <span className="text-2xl">{z.icon}</span>
                <span
                  className="text-xs font-semibold mt-1 px-2"
                  style={{ color: "var(--space-fg)" }}
                >
                  {z.name}
                </span>
                {isOwner && editMode && (
                  <span
                    onMouseDown={(e) => onZoneMouseDown(e, z.name, "resize-br")}
                    className="absolute bottom-0 right-0 h-3 w-3 cursor-nwse-resize"
                    style={{
                      background: z.color,
                      borderTopLeftRadius: 4,
                    }}
                  />
                )}
              </div>
            );
          })}

          {zones.length === 0 && (
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{ color: "var(--space-fg-soft)" }}
            >
              <div className="text-center">
                <span className="text-5xl block mb-2">🗺️</span>
                <p>구역을 먼저 추가하세요</p>
              </div>
            </div>
          )}
        </div>

        <aside
          className="rounded-xl p-4 border h-fit"
          style={{
            background: "var(--space-card)",
            borderColor: "var(--space-border)",
          }}
        >
          {selectedZone ? (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">{selectedZone.icon}</span>
                <h3 className="font-bold">{selectedZone.name}</h3>
              </div>
              <p
                className="text-xs mb-3"
                style={{ color: "var(--space-fg-soft)" }}
              >
                {selectedZone.ecosystem_type} · {selectedZone.climate ?? "—"}
              </p>
              {selectedZone.description && (
                <p
                  className="text-sm mb-3"
                  style={{ color: "var(--space-fg-muted)" }}
                >
                  {selectedZone.description}
                </p>
              )}
              <div
                className="flex justify-between text-xs pt-3 border-t"
                style={{ borderColor: "var(--space-border)" }}
              >
                <span>🌱 식물 {selectedZone.plant_count}</span>
                <span>🦊 생물 {selectedZone.creature_count}</span>
              </div>
            </div>
          ) : (
            <div
              className="text-sm text-center py-6"
              style={{ color: "var(--space-fg-soft)" }}
            >
              구역을 선택하면 정보가 표시됩니다.
              {isOwner && editMode && (
                <p className="mt-3">
                  드래그로 이동, 우하단 점으로 크기 조절
                </p>
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
