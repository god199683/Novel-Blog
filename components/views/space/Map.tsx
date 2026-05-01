"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase, type Zone } from "@/lib/supabase";
import { useSpace } from "@/components/space/SpaceContext";

type Pos = { x: number; y: number; w: number; h: number };
type Marker = {
  id: string;
  emoji: string;
  label: string;
  x: number;
  y: number;
  size: number; // 1~3
};

type DragMode =
  | "move"
  | "resize-tl"
  | "resize-tr"
  | "resize-bl"
  | "resize-br"
  | "resize-t"
  | "resize-b"
  | "resize-l"
  | "resize-r";

const DEFAULTS: Record<string, Pos> = {
  "세계수 주변": { x: 35, y: 28, w: 26, h: 26 },
  "호수 구역": { x: 28, y: 50, w: 28, h: 22 },
  "저택 정원": { x: 50, y: 5, w: 26, h: 22 },
  "약초 밭": { x: 5, y: 15, w: 18, h: 20 },
  "영수 서식지": { x: 60, y: 60, w: 20, h: 20 },
};

const DEFAULT_MARKERS: Marker[] = [
  { id: "m1", emoji: "🌸", label: "벚꽃", x: 75, y: 8, size: 2 },
  { id: "m2", emoji: "🍄", label: "버섯", x: 85, y: 20, size: 2 },
  { id: "m3", emoji: "🦋", label: "나비", x: 88, y: 80, size: 2 },
  { id: "m4", emoji: "🌿", label: "풀", x: 5, y: 45, size: 2 },
  { id: "m5", emoji: "✨", label: "빛", x: 75, y: 30, size: 1 },
];

const MARKER_EMOJIS = [
  "🌸", "🍄", "🦋", "🌿", "✨", "🌺", "🍀", "🐦", "🌻", "💎", "🔮", "🕯️",
  "🪴", "🌾", "🍃", "🐝", "🐛", "🦌", "🐿️", "🦉", "⭐", "🌙", "🔥", "❄️",
  "💫", "🪨", "🏵️", "⛲", "🗿", "🪦",
];

const MIN_SIZE = 8;

export default function SpaceMapView() {
  const { space, isOwner } = useSpace();
  const [zones, setZones] = useState<Zone[]>([]);
  const [positions, setPositions] = useState<Record<string, Pos>>({});
  const [markers, setMarkers] = useState<Marker[]>(DEFAULT_MARKERS);
  const [loading, setLoading] = useState(true);

  const [editMode, setEditMode] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [tool, setTool] = useState<"select" | "marker">("select");
  const [pendingEmoji, setPendingEmoji] = useState("🌸");

  // 드래그 상태
  const [draggingZone, setDraggingZone] = useState<string | null>(null);
  const [dragMode, setDragMode] = useState<DragMode>("move");
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [dragStartPos, setDragStartPos] = useState<Pos>({
    x: 0,
    y: 0,
    w: 0,
    h: 0,
  });
  const [draggingMarker, setDraggingMarker] = useState<string | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const sb = supabase();
      const [zonesRes, posRes, markersRes] = await Promise.all([
        sb.from("zones").select("*").eq("space_id", space.id).order("created_at"),
        sb
          .from("garden_settings")
          .select("*")
          .eq("space_id", space.id)
          .eq("key", "zone_positions")
          .maybeSingle(),
        sb
          .from("garden_settings")
          .select("*")
          .eq("space_id", space.id)
          .eq("key", "map_markers")
          .maybeSingle(),
      ]);
      if (!active) return;
      const zs = (zonesRes.data ?? []) as Zone[];
      setZones(zs);

      let stored: Record<string, Pos> = {};
      if (posRes.data?.value) {
        try {
          stored = JSON.parse(posRes.data.value);
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

      if (markersRes.data?.value) {
        try {
          setMarkers(JSON.parse(markersRes.data.value));
        } catch {
          setMarkers([...DEFAULT_MARKERS]);
        }
      }

      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [space.id]);

  const persistPositions = useCallback(
    async (next: Record<string, Pos>) => {
      await supabase()
        .from("garden_settings")
        .upsert(
          {
            space_id: space.id,
            key: "zone_positions",
            value: JSON.stringify(next),
            description: "맵 구역 위치",
          },
          { onConflict: "space_id,key" }
        );
    },
    [space.id]
  );

  const persistMarkers = useCallback(
    async (next: Marker[]) => {
      await supabase()
        .from("garden_settings")
        .upsert(
          {
            space_id: space.id,
            key: "map_markers",
            value: JSON.stringify(next),
            description: "맵 장식 마커",
          },
          { onConflict: "space_id,key" }
        );
    },
    [space.id]
  );

  const pctFromEvent = (e: React.MouseEvent) => {
    const rect = mapRef.current!.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    };
  };

  const onZoneMouseDown = (
    e: React.MouseEvent,
    zoneName: string,
    mode: DragMode
  ) => {
    if (!editMode || !isOwner || !mapRef.current) return;
    e.preventDefault();
    e.stopPropagation();
    const pt = pctFromEvent(e);
    setDragStart(pt);
    setDragStartPos({
      ...(positions[zoneName] ?? DEFAULTS[zoneName] ?? { x: 0, y: 0, w: 16, h: 14 }),
    });
    setDraggingZone(zoneName);
    setDragMode(mode);
    setSelected(`zone:${zoneName}`);
  };

  const onMarkerMouseDown = (e: React.MouseEvent, markerId: string) => {
    if (!editMode || !isOwner || !mapRef.current) return;
    e.preventDefault();
    e.stopPropagation();
    setDraggingMarker(markerId);
    setSelected(`marker:${markerId}`);
  };

  const onMapMouseDown = (e: React.MouseEvent) => {
    if (!editMode || !isOwner || !mapRef.current) return;
    if (e.target !== e.currentTarget) return;
    if (tool === "marker") {
      const pt = pctFromEvent(e);
      const m: Marker = {
        id: `m${Date.now()}`,
        emoji: pendingEmoji,
        label: pendingEmoji,
        x: pt.x,
        y: pt.y,
        size: 2,
      };
      const next = [...markers, m];
      setMarkers(next);
      persistMarkers(next);
      setSelected(`marker:${m.id}`);
      setTool("select");
    } else {
      setSelected(null);
    }
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (!mapRef.current) return;

    if (draggingMarker) {
      const pt = pctFromEvent(e);
      setMarkers((prev) =>
        prev.map((m) =>
          m.id === draggingMarker
            ? {
                ...m,
                x: Math.max(0, Math.min(100, pt.x)),
                y: Math.max(0, Math.min(100, pt.y)),
              }
            : m
        )
      );
      return;
    }

    if (!draggingZone) return;
    const pt = pctFromEvent(e);
    const dx = pt.x - dragStart.x;
    const dy = pt.y - dragStart.y;
    const sp = dragStartPos;

    setPositions((prev) => {
      let { x, y, w, h } = sp;
      switch (dragMode) {
        case "move":
          x = Math.max(0, Math.min(100 - w, sp.x + dx));
          y = Math.max(0, Math.min(100 - h, sp.y + dy));
          break;
        case "resize-r":
          w = Math.max(MIN_SIZE, Math.min(100 - x, sp.w + dx));
          break;
        case "resize-l": {
          const nx = Math.max(0, sp.x + dx);
          w = Math.max(MIN_SIZE, sp.w - (nx - sp.x));
          if (w > MIN_SIZE) x = nx;
          break;
        }
        case "resize-b":
          h = Math.max(MIN_SIZE, Math.min(100 - y, sp.h + dy));
          break;
        case "resize-t": {
          const ny = Math.max(0, sp.y + dy);
          h = Math.max(MIN_SIZE, sp.h - (ny - sp.y));
          if (h > MIN_SIZE) y = ny;
          break;
        }
        case "resize-br":
          w = Math.max(MIN_SIZE, Math.min(100 - x, sp.w + dx));
          h = Math.max(MIN_SIZE, Math.min(100 - y, sp.h + dy));
          break;
        case "resize-bl": {
          const nx = Math.max(0, sp.x + dx);
          w = Math.max(MIN_SIZE, sp.w - (nx - sp.x));
          if (w > MIN_SIZE) x = nx;
          h = Math.max(MIN_SIZE, Math.min(100 - y, sp.h + dy));
          break;
        }
        case "resize-tr": {
          const ny = Math.max(0, sp.y + dy);
          h = Math.max(MIN_SIZE, sp.h - (ny - sp.y));
          if (h > MIN_SIZE) y = ny;
          w = Math.max(MIN_SIZE, Math.min(100 - x, sp.w + dx));
          break;
        }
        case "resize-tl": {
          const nx = Math.max(0, sp.x + dx);
          const ny = Math.max(0, sp.y + dy);
          w = Math.max(MIN_SIZE, sp.w - (nx - sp.x));
          h = Math.max(MIN_SIZE, sp.h - (ny - sp.y));
          if (w > MIN_SIZE) x = nx;
          if (h > MIN_SIZE) y = ny;
          break;
        }
      }
      return { ...prev, [draggingZone]: { x, y, w, h } };
    });
  };

  const onMouseUp = () => {
    if (draggingMarker) {
      persistMarkers(markers);
      setDraggingMarker(null);
    }
    if (draggingZone) {
      persistPositions(positions);
      setDraggingZone(null);
    }
  };

  const removeSelected = () => {
    if (!selected) return;
    if (selected.startsWith("marker:")) {
      const id = selected.slice(7);
      const next = markers.filter((m) => m.id !== id);
      setMarkers(next);
      persistMarkers(next);
      setSelected(null);
    }
    // 구역(zone:) 삭제는 zones 관리 페이지에서만 가능 — 여기선 위치 초기화만 제공
  };

  const updateSelectedMarker = (patch: Partial<Marker>) => {
    if (!selected?.startsWith("marker:")) return;
    const id = selected.slice(7);
    const next = markers.map((m) => (m.id === id ? { ...m, ...patch } : m));
    setMarkers(next);
    persistMarkers(next);
  };

  const resetAll = async () => {
    if (!confirm("배치와 장식을 모두 초기화할까요?")) return;
    const reset: Record<string, Pos> = {};
    zones.forEach((z, i) => {
      reset[z.name] =
        DEFAULTS[z.name] ?? { x: 5 + (i % 4) * 22, y: 80, w: 16, h: 14 };
    });
    setPositions(reset);
    setMarkers([...DEFAULT_MARKERS]);
    await Promise.all([persistPositions(reset), persistMarkers(DEFAULT_MARKERS)]);
    setSelected(null);
  };

  const selectedKind = selected?.split(":")[0];
  const selectedZone = useMemo(() => {
    if (selected?.startsWith("zone:"))
      return zones.find((z) => z.name === selected.slice(5)) ?? null;
    return null;
  }, [selected, zones]);
  const selectedMarker = useMemo(() => {
    if (selected?.startsWith("marker:"))
      return markers.find((m) => m.id === selected.slice(7)) ?? null;
    return null;
  }, [selected, markers]);

  if (loading)
    return (
      <div className="flex items-center justify-center h-96">
        <p style={{ color: "var(--space-fg-muted)" }}>로딩 중...</p>
      </div>
    );

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">🌍 정원 맵</h1>
          <p
            className="text-sm mt-1"
            style={{ color: "var(--space-fg-muted)" }}
          >
            구역을 자유롭게 배치하고 마커로 꾸며보세요
          </p>
        </div>
        {isOwner && (
          <div className="flex gap-2">
            <button
              onClick={() => {
                setEditMode((m) => !m);
                if (editMode) setTool("select");
              }}
              className="px-4 py-2 rounded-lg text-sm font-medium text-white"
              style={{
                background: editMode ? "#e8a63a" : "var(--space-accent)",
              }}
            >
              {editMode ? "✓ 편집 종료" : "✎ 편집 모드"}
            </button>
            {editMode && (
              <button
                onClick={resetAll}
                className="px-4 py-2 rounded-lg text-sm border"
                style={{
                  borderColor: "var(--space-border)",
                  color: "var(--space-fg-muted)",
                }}
              >
                전체 초기화
              </button>
            )}
          </div>
        )}
      </div>

      {/* 도구 모음 — 편집 모드일 때만 */}
      {editMode && isOwner && (
        <div
          className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border p-2 text-sm"
          style={{
            background: "var(--space-card)",
            borderColor: "var(--space-border)",
          }}
        >
          <button
            type="button"
            onClick={() => setTool("select")}
            className="rounded px-3 py-1 text-xs"
            style={
              tool === "select"
                ? { background: "var(--space-accent)", color: "white" }
                : { color: "var(--space-fg-muted)" }
            }
          >
            ↖ 선택/이동
          </button>
          <button
            type="button"
            onClick={() => setTool("marker")}
            className="rounded px-3 py-1 text-xs"
            style={
              tool === "marker"
                ? { background: "var(--space-accent)", color: "white" }
                : { color: "var(--space-fg-muted)" }
            }
          >
            ✨ 마커 찍기
          </button>
          <span className="mx-1 h-5 w-px" style={{ background: "var(--space-border)" }} />
          <span className="text-xs" style={{ color: "var(--space-fg-soft)" }}>
            마커:
          </span>
          <div className="flex flex-wrap gap-1">
            {MARKER_EMOJIS.map((em) => (
              <button
                key={em}
                type="button"
                onClick={() => {
                  setPendingEmoji(em);
                  setTool("marker");
                }}
                className="text-base p-1 rounded hover:bg-[var(--space-card-hover)]"
                style={
                  pendingEmoji === em && tool === "marker"
                    ? {
                        background: "var(--space-accent-soft)",
                        outline: "2px solid var(--space-accent)",
                      }
                    : {}
                }
              >
                {em}
              </button>
            ))}
          </div>
          {selected && (
            <>
              <span
                className="mx-1 h-5 w-px"
                style={{ background: "var(--space-border)" }}
              />
              {selected.startsWith("marker:") && (
                <button
                  onClick={removeSelected}
                  className="rounded px-2 py-1 text-xs"
                  style={{
                    background: "rgba(229,91,91,0.15)",
                    color: "#e55b5b",
                  }}
                >
                  마커 삭제
                </button>
              )}
            </>
          )}
        </div>
      )}

      <div className="grid lg:grid-cols-[1fr_280px] gap-4">
        <div
          ref={mapRef}
          onMouseDown={onMapMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          className="relative rounded-2xl border overflow-hidden"
          style={{
            background:
              "radial-gradient(ellipse at center, rgba(74,168,216,0.06) 0%, var(--space-card) 70%)",
            borderColor: "var(--space-border)",
            aspectRatio: "1 / 1",
            cursor:
              editMode && tool === "marker" ? "crosshair" : "default",
            userSelect: draggingZone || draggingMarker ? "none" : "auto",
          }}
        >
          {zones.map((z) => {
            const pos =
              positions[z.name] ??
              DEFAULTS[z.name] ?? { x: 0, y: 0, w: 16, h: 14 };
            const isSelected = selected === `zone:${z.name}`;
            return (
              <div
                key={z.id}
                onMouseDown={(e) => {
                  if (editMode && tool === "select")
                    onZoneMouseDown(e, z.name, "move");
                  else if (!editMode) setSelected(`zone:${z.name}`);
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelected(`zone:${z.name}`);
                }}
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
                  cursor:
                    editMode && tool === "select" ? "move" : "pointer",
                  boxShadow: isSelected
                    ? `0 0 0 3px ${z.color}66`
                    : "0 2px 8px rgba(74,168,216,0.1)",
                }}
              >
                <span className="text-2xl pointer-events-none">{z.icon}</span>
                <span
                  className="text-xs font-semibold mt-1 px-2 pointer-events-none"
                  style={{ color: "var(--space-fg)" }}
                >
                  {z.name}
                </span>
                {/* 8방향 리사이즈 핸들 — 편집 모드 + 선택됐을 때만 */}
                {editMode && isOwner && tool === "select" && isSelected && (
                  <>
                    <Handle dir="resize-tl" onDown={(e) => onZoneMouseDown(e, z.name, "resize-tl")} />
                    <Handle dir="resize-tr" onDown={(e) => onZoneMouseDown(e, z.name, "resize-tr")} />
                    <Handle dir="resize-bl" onDown={(e) => onZoneMouseDown(e, z.name, "resize-bl")} />
                    <Handle dir="resize-br" onDown={(e) => onZoneMouseDown(e, z.name, "resize-br")} />
                    <Handle dir="resize-t" onDown={(e) => onZoneMouseDown(e, z.name, "resize-t")} />
                    <Handle dir="resize-b" onDown={(e) => onZoneMouseDown(e, z.name, "resize-b")} />
                    <Handle dir="resize-l" onDown={(e) => onZoneMouseDown(e, z.name, "resize-l")} />
                    <Handle dir="resize-r" onDown={(e) => onZoneMouseDown(e, z.name, "resize-r")} />
                  </>
                )}
              </div>
            );
          })}

          {/* 마커들 */}
          {markers.map((m) => {
            const isSelected = selected === `marker:${m.id}`;
            const fontSize = 12 + m.size * 6;
            return (
              <div
                key={m.id}
                onMouseDown={(e) => {
                  if (editMode && tool === "select") onMarkerMouseDown(e, m.id);
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelected(`marker:${m.id}`);
                }}
                className="absolute -translate-x-1/2 -translate-y-1/2 select-none"
                style={{
                  left: `${m.x}%`,
                  top: `${m.y}%`,
                  fontSize,
                  cursor:
                    editMode && tool === "select" ? "move" : "default",
                  filter: isSelected
                    ? "drop-shadow(0 0 6px var(--space-accent))"
                    : "none",
                }}
                title={m.label}
              >
                {m.emoji}
              </div>
            );
          })}

          {zones.length === 0 && (
            <div
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
              style={{ color: "var(--space-fg-soft)" }}
            >
              <div className="text-center">
                <span className="text-5xl block mb-2">🗺️</span>
                <p>구역을 먼저 추가하세요</p>
              </div>
            </div>
          )}
        </div>

        {/* 우측 속성 패널 */}
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
                className="flex justify-between text-xs pt-3 border-t mb-3"
                style={{ borderColor: "var(--space-border)" }}
              >
                <span>🌱 식물 {selectedZone.plant_count}</span>
                <span>🦊 생물 {selectedZone.creature_count}</span>
              </div>
              {editMode && isOwner && (
                <p
                  className="text-xs"
                  style={{ color: "var(--space-fg-soft)" }}
                >
                  드래그로 이동, 8개 핸들로 크기 조절. 구역 자체의 이름·색·삭제는 <strong>구역 관리</strong> 페이지에서.
                </p>
              )}
            </div>
          ) : selectedMarker ? (
            <div>
              <p
                className="text-xs font-medium mb-3"
                style={{ color: "var(--space-fg-muted)" }}
              >
                ✨ 마커 속성
              </p>
              <label className="block text-xs mb-1" style={{ color: "var(--space-fg-muted)" }}>
                이모지
              </label>
              <input
                type="text"
                value={selectedMarker.emoji}
                onChange={(e) => updateSelectedMarker({ emoji: e.target.value })}
                disabled={!editMode || !isOwner}
                maxLength={4}
                className="w-full rounded border px-2 py-1 text-xl text-center mb-3"
                style={{
                  background: "var(--space-bg)",
                  borderColor: "var(--space-border)",
                  color: "var(--space-fg)",
                }}
              />
              <label className="block text-xs mb-1" style={{ color: "var(--space-fg-muted)" }}>
                이름
              </label>
              <input
                type="text"
                value={selectedMarker.label}
                onChange={(e) => updateSelectedMarker({ label: e.target.value })}
                disabled={!editMode || !isOwner}
                className="w-full rounded border px-2 py-1 text-sm mb-3"
                style={{
                  background: "var(--space-bg)",
                  borderColor: "var(--space-border)",
                  color: "var(--space-fg)",
                }}
              />
              <label className="block text-xs mb-1" style={{ color: "var(--space-fg-muted)" }}>
                크기 ({selectedMarker.size})
              </label>
              <input
                type="range"
                min={1}
                max={3}
                value={selectedMarker.size}
                onChange={(e) =>
                  updateSelectedMarker({ size: parseInt(e.target.value, 10) })
                }
                disabled={!editMode || !isOwner}
                className="w-full mb-3"
              />
              {editMode && isOwner && (
                <button
                  onClick={removeSelected}
                  className="w-full rounded px-2 py-1 text-xs"
                  style={{
                    background: "rgba(229,91,91,0.15)",
                    color: "#e55b5b",
                  }}
                >
                  마커 삭제
                </button>
              )}
            </div>
          ) : (
            <div
              className="text-sm text-center py-6"
              style={{ color: "var(--space-fg-soft)" }}
            >
              <p className="mb-2">구역이나 마커를 선택하면<br />속성이 표시됩니다.</p>
              {editMode && isOwner && tool === "marker" && (
                <p className="mt-3 text-xs">
                  맵 빈 곳을 클릭해 <span className="text-2xl align-middle">{pendingEmoji}</span> 마커를 찍으세요
                </p>
              )}
              {editMode && isOwner && tool === "select" && (
                <p className="mt-3 text-xs">
                  구역 클릭 → 8방향 핸들로 자유 분할.<br />
                  마커는 드래그로 이동.
                </p>
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function Handle({
  dir,
  onDown,
}: {
  dir: DragMode;
  onDown: (e: React.MouseEvent) => void;
}) {
  const style: React.CSSProperties = {
    position: "absolute",
    width: 10,
    height: 10,
    background: "white",
    border: "2px solid var(--space-accent)",
    borderRadius: 2,
  };
  let cursor = "default";
  switch (dir) {
    case "resize-tl":
      style.top = -5; style.left = -5; cursor = "nwse-resize"; break;
    case "resize-tr":
      style.top = -5; style.right = -5; cursor = "nesw-resize"; break;
    case "resize-bl":
      style.bottom = -5; style.left = -5; cursor = "nesw-resize"; break;
    case "resize-br":
      style.bottom = -5; style.right = -5; cursor = "nwse-resize"; break;
    case "resize-t":
      style.top = -5; style.left = "calc(50% - 5px)"; cursor = "ns-resize"; break;
    case "resize-b":
      style.bottom = -5; style.left = "calc(50% - 5px)"; cursor = "ns-resize"; break;
    case "resize-l":
      style.left = -5; style.top = "calc(50% - 5px)"; cursor = "ew-resize"; break;
    case "resize-r":
      style.right = -5; style.top = "calc(50% - 5px)"; cursor = "ew-resize"; break;
  }
  return (
    <span
      onMouseDown={onDown}
      style={{ ...style, cursor }}
    />
  );
}
