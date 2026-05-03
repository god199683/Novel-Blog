"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useSpace } from "@/components/space/SpaceContext";

// ─────────────────────────────────────────────────────────────
//  도트(타일) 맵 에디터
// ─────────────────────────────────────────────────────────────

const GRID = 32;

type Terrain = { id: number; name: string; color: string };
const TERRAIN: Terrain[] = [
  { id: 0, name: "비움", color: "transparent" },
  { id: 1, name: "잔디", color: "#7cba3d" },
  { id: 2, name: "짙은풀", color: "#3e8a3e" },
  { id: 3, name: "흙", color: "#8b6f47" },
  { id: 4, name: "돌길", color: "#9aa0a6" },
  { id: 5, name: "물", color: "#3490b3" },
  { id: 6, name: "심해", color: "#1f5e7a" },
  { id: 7, name: "모래", color: "#e8d086" },
  { id: 8, name: "꽃밭", color: "#e8b4d8" },
  { id: 9, name: "눈", color: "#eaf4fc" },
  { id: 10, name: "용암", color: "#e0521e" },
  { id: 11, name: "마룻바닥", color: "#c89968" },
  { id: 12, name: "벽", color: "#5a4434" },
  { id: 13, name: "꽃길", color: "#f7c873" },
  { id: 14, name: "이끼", color: "#6f8a3a" },
  { id: 15, name: "어둠", color: "#1f1f2e" },
];

const OBJECT_EMOJIS = [
  "🌳", "🌲", "🌴", "🌵", "🌸", "🌺", "🌻", "🌷",
  "🍄", "🌿", "🪴", "🌾", "🪨", "⛲", "🗿", "🏛️",
  "🏠", "🏰", "⛩️", "🕯️", "🚪", "🛏️", "🪑",
  "🐦", "🦌", "🦊", "🐰", "🦋", "🐝", "🐛",
  "✨", "⭐", "🌙", "☀️", "🔥", "❄️", "💧", "💎",
];

type Marker = {
  id: string;
  x: number; // tile col 0..GRID-1
  y: number; // tile row 0..GRID-1
  emoji: string;
  label?: string;
};

type Tool = "paint" | "fill" | "eraser" | "object" | "select";

const newId = () =>
  `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export default function SpaceMapView() {
  const { space, isOwner } = useSpace();
  const [tiles, setTiles] = useState<number[]>(() =>
    new Array(GRID * GRID).fill(0)
  );
  const [markers, setMarkers] = useState<Marker[]>([]);
  const [loading, setLoading] = useState(true);

  const [editMode, setEditMode] = useState(false);
  const [tool, setTool] = useState<Tool>("paint");
  const [terrainId, setTerrainId] = useState(1);
  const [pendingEmoji, setPendingEmoji] = useState("🌳");
  const [showGrid, setShowGrid] = useState(true);
  const [selectedMarker, setSelectedMarker] = useState<string | null>(null);

  const isStrokingRef = useRef(false);
  const draggingMarkerRef = useRef<string | null>(null);
  const lastTileRef = useRef<{ x: number; y: number } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const sb = supabase();
      const [tRes, mRes] = await Promise.all([
        sb
          .from("garden_settings")
          .select("*")
          .eq("space_id", space.id)
          .eq("key", "tilemap")
          .maybeSingle(),
        sb
          .from("garden_settings")
          .select("*")
          .eq("space_id", space.id)
          .eq("key", "map_markers")
          .maybeSingle(),
      ]);
      if (!active) return;
      if (tRes.data?.value) {
        try {
          const parsed = JSON.parse(tRes.data.value);
          if (Array.isArray(parsed) && parsed.length === GRID * GRID) {
            setTiles(parsed);
          }
        } catch {}
      }
      if (mRes.data?.value) {
        try {
          const parsed = JSON.parse(mRes.data.value);
          if (Array.isArray(parsed)) {
            const normalized: Marker[] = parsed.map((m) => {
              const x = typeof m.x === "number" ? m.x : 0;
              const y = typeof m.y === "number" ? m.y : 0;
              const isPercent = x > GRID || y > GRID; // 옛 데이터(0~100 %) 호환
              return {
                id: m.id ?? newId(),
                emoji: m.emoji ?? "❓",
                label: m.label,
                x: isPercent
                  ? Math.round((x / 100) * (GRID - 1))
                  : Math.max(0, Math.min(GRID - 1, Math.round(x))),
                y: isPercent
                  ? Math.round((y / 100) * (GRID - 1))
                  : Math.max(0, Math.min(GRID - 1, Math.round(y))),
              };
            });
            setMarkers(normalized);
          }
        } catch {}
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [space.id]);

  const persistTiles = useCallback(
    async (next: number[]) => {
      const sb = supabase();
      const { data: existing } = await sb
        .from("garden_settings")
        .select("id")
        .eq("space_id", space.id)
        .eq("key", "tilemap")
        .maybeSingle();
      if (existing) {
        await sb
          .from("garden_settings")
          .update({ value: JSON.stringify(next) })
          .eq("id", existing.id);
      } else {
        await sb.from("garden_settings").insert({
          space_id: space.id,
          key: "tilemap",
          value: JSON.stringify(next),
          description: "도트 맵 타일",
        });
      }
    },
    [space.id]
  );

  const persistMarkers = useCallback(
    async (next: Marker[]) => {
      const sb = supabase();
      const { data: existing } = await sb
        .from("garden_settings")
        .select("id")
        .eq("space_id", space.id)
        .eq("key", "map_markers")
        .maybeSingle();
      if (existing) {
        await sb
          .from("garden_settings")
          .update({ value: JSON.stringify(next) })
          .eq("id", existing.id);
      } else {
        await sb.from("garden_settings").insert({
          space_id: space.id,
          key: "map_markers",
          value: JSON.stringify(next),
          description: "맵 마커",
        });
      }
    },
    [space.id]
  );

  const tileAtEvent = (
    e: React.MouseEvent
  ): { x: number; y: number } | null => {
    if (!canvasRef.current) return null;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = Math.floor(((e.clientX - rect.left) / rect.width) * GRID);
    const y = Math.floor(((e.clientY - rect.top) / rect.height) * GRID);
    if (x < 0 || x >= GRID || y < 0 || y >= GRID) return null;
    return { x, y };
  };

  const paintAt = (x: number, y: number, id: number) => {
    setTiles((prev) => {
      const idx = y * GRID + x;
      if (prev[idx] === id) return prev;
      const next = prev.slice();
      next[idx] = id;
      return next;
    });
  };

  const fillFromTile = (x: number, y: number, replaceWith: number) => {
    setTiles((prev) => {
      const idx0 = y * GRID + x;
      const target = prev[idx0];
      if (target === replaceWith) return prev;
      const next = prev.slice();
      const stack: [number, number][] = [[x, y]];
      while (stack.length) {
        const [cx, cy] = stack.pop()!;
        if (cx < 0 || cx >= GRID || cy < 0 || cy >= GRID) continue;
        const i = cy * GRID + cx;
        if (next[i] !== target) continue;
        next[i] = replaceWith;
        stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
      }
      return next;
    });
  };

  const onCanvasMouseDown = (e: React.MouseEvent) => {
    if (!editMode || !isOwner) return;
    const t = tileAtEvent(e);
    if (!t) return;

    if (tool === "paint" || tool === "eraser") {
      paintAt(t.x, t.y, tool === "paint" ? terrainId : 0);
      isStrokingRef.current = true;
      lastTileRef.current = t;
    } else if (tool === "fill") {
      fillFromTile(t.x, t.y, terrainId);
    } else if (tool === "object") {
      const existing = markers.find((m) => m.x === t.x && m.y === t.y);
      let next: Marker[];
      if (existing) {
        next = markers.map((m) =>
          m.id === existing.id ? { ...m, emoji: pendingEmoji } : m
        );
      } else {
        next = [
          ...markers,
          { id: newId(), x: t.x, y: t.y, emoji: pendingEmoji },
        ];
      }
      setMarkers(next);
      persistMarkers(next);
    } else if (tool === "select") {
      const m = markers.find((mm) => mm.x === t.x && mm.y === t.y);
      if (m) {
        setSelectedMarker(m.id);
        draggingMarkerRef.current = m.id;
      } else {
        setSelectedMarker(null);
      }
    }
  };

  const onCanvasMouseMove = (e: React.MouseEvent) => {
    if (!editMode || !isOwner) return;
    const t = tileAtEvent(e);
    if (!t) return;

    if (isStrokingRef.current && (tool === "paint" || tool === "eraser")) {
      const last = lastTileRef.current;
      if (last && last.x === t.x && last.y === t.y) return;
      paintAt(t.x, t.y, tool === "paint" ? terrainId : 0);
      lastTileRef.current = t;
    } else if (draggingMarkerRef.current) {
      const id = draggingMarkerRef.current;
      setMarkers((prev) =>
        prev.map((m) => (m.id === id ? { ...m, x: t.x, y: t.y } : m))
      );
    }
  };

  const onCanvasMouseUp = () => {
    if (isStrokingRef.current) {
      isStrokingRef.current = false;
      lastTileRef.current = null;
      persistTiles(tiles);
    }
    if (draggingMarkerRef.current) {
      draggingMarkerRef.current = null;
      persistMarkers(markers);
    }
  };

  const updateSelectedMarker = (patch: Partial<Marker>) => {
    if (!selectedMarker) return;
    const next = markers.map((m) =>
      m.id === selectedMarker ? { ...m, ...patch } : m
    );
    setMarkers(next);
    persistMarkers(next);
  };

  const removeSelectedMarker = () => {
    if (!selectedMarker) return;
    const next = markers.filter((m) => m.id !== selectedMarker);
    setMarkers(next);
    persistMarkers(next);
    setSelectedMarker(null);
  };

  const fillCanvas = async () => {
    const filled = new Array(GRID * GRID).fill(terrainId);
    setTiles(filled);
    await persistTiles(filled);
  };

  const clearMap = async () => {
    if (!confirm("타일과 마커를 모두 지울까요?")) return;
    const empty = new Array(GRID * GRID).fill(0);
    setTiles(empty);
    setMarkers([]);
    await Promise.all([persistTiles(empty), persistMarkers([])]);
    setSelectedMarker(null);
  };

  const selMarker = useMemo(
    () => markers.find((m) => m.id === selectedMarker) ?? null,
    [markers, selectedMarker]
  );

  if (loading)
    return (
      <div className="flex items-center justify-center h-96">
        <p style={{ color: "var(--space-fg-muted)" }}>로딩 중...</p>
      </div>
    );

  const tilePct = 100 / GRID;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">🌍 정원 맵</h1>
          <p
            className="text-sm mt-1"
            style={{ color: "var(--space-fg-muted)" }}
          >
            {GRID}×{GRID} 도트 맵 — 지형을 칠하고 객체를 배치해요
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
              <>
                <button
                  onClick={fillCanvas}
                  className="px-3 py-2 rounded-lg text-xs border"
                  style={{
                    borderColor: "var(--space-border)",
                    color: "var(--space-fg-muted)",
                  }}
                  title={`전체를 ${TERRAIN[terrainId].name} 으로 채우기`}
                >
                  🪣 전체 채우기
                </button>
                <button
                  onClick={clearMap}
                  className="px-3 py-2 rounded-lg text-xs border"
                  style={{
                    borderColor: "rgba(229,91,91,0.5)",
                    color: "#e55b5b",
                  }}
                >
                  맵 비우기
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {editMode && isOwner && (
        <div
          className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border p-2 text-sm"
          style={{
            background: "var(--space-card)",
            borderColor: "var(--space-border)",
          }}
        >
          <ToolBtn active={tool === "paint"} onClick={() => setTool("paint")}>
            🖌️ 페인트
          </ToolBtn>
          <ToolBtn active={tool === "fill"} onClick={() => setTool("fill")}>
            🪣 채우기
          </ToolBtn>
          <ToolBtn active={tool === "eraser"} onClick={() => setTool("eraser")}>
            🧹 지우개
          </ToolBtn>
          <ToolBtn active={tool === "object"} onClick={() => setTool("object")}>
            ✨ 객체
          </ToolBtn>
          <ToolBtn active={tool === "select"} onClick={() => setTool("select")}>
            ↖ 선택
          </ToolBtn>
          <span
            className="mx-1 h-5 w-px"
            style={{ background: "var(--space-border)" }}
          />
          <button
            type="button"
            onClick={() => setShowGrid((g) => !g)}
            className="rounded px-2 py-1 text-xs"
            style={{
              background: showGrid
                ? "var(--space-accent-soft)"
                : "transparent",
              color: showGrid
                ? "var(--space-accent)"
                : "var(--space-fg-muted)",
            }}
          >
            # 격자
          </button>
        </div>
      )}

      <div className="grid lg:grid-cols-[1fr_280px] gap-4">
        <div
          ref={canvasRef}
          onMouseDown={onCanvasMouseDown}
          onMouseMove={onCanvasMouseMove}
          onMouseUp={onCanvasMouseUp}
          onMouseLeave={onCanvasMouseUp}
          className="relative overflow-hidden rounded-2xl border w-full"
          style={{
            aspectRatio: "1 / 1",
            maxHeight: "calc(100vh - 220px)",
            background:
              "radial-gradient(ellipse at center, rgba(74,168,216,0.06) 0%, var(--space-card) 70%)",
            borderColor: "var(--space-border)",
            cursor:
              !editMode || !isOwner
                ? "default"
                : tool === "object" || tool === "fill"
                  ? "crosshair"
                  : tool === "eraser"
                    ? "cell"
                    : tool === "select"
                      ? "default"
                      : "crosshair",
            userSelect: "none",
            imageRendering: "pixelated",
          }}
        >
          <svg
            viewBox={`0 0 ${GRID} ${GRID}`}
            preserveAspectRatio="none"
            shapeRendering="crispEdges"
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              pointerEvents: "none",
            }}
          >
            {tiles.map((id, i) => {
              if (id === 0) return null;
              const x = i % GRID;
              const y = Math.floor(i / GRID);
              return (
                <rect
                  key={i}
                  x={x}
                  y={y}
                  width={1}
                  height={1}
                  fill={TERRAIN[id]?.color ?? "#888"}
                />
              );
            })}
            {showGrid && (
              <g stroke="rgba(0,0,0,0.06)" strokeWidth={0.02}>
                {Array.from({ length: GRID + 1 }, (_, i) => (
                  <line key={`v${i}`} x1={i} y1={0} x2={i} y2={GRID} />
                ))}
                {Array.from({ length: GRID + 1 }, (_, i) => (
                  <line key={`h${i}`} x1={0} y1={i} x2={GRID} y2={i} />
                ))}
              </g>
            )}
          </svg>

          {markers.map((m) => {
            const isSel = selectedMarker === m.id;
            return (
              <div
                key={m.id}
                className="absolute -translate-x-1/2 -translate-y-1/2 select-none pointer-events-none"
                style={{
                  left: `${(m.x + 0.5) * tilePct}%`,
                  top: `${(m.y + 0.5) * tilePct}%`,
                  fontSize: "min(2.5vw, 26px)",
                  filter: isSel
                    ? "drop-shadow(0 0 4px var(--space-accent))"
                    : "drop-shadow(0 1px 1px rgba(0,0,0,0.3))",
                }}
                title={m.label ?? m.emoji}
              >
                {m.emoji}
              </div>
            );
          })}
        </div>

        <aside
          className="rounded-xl p-4 border h-fit space-y-4"
          style={{
            background: "var(--space-card)",
            borderColor: "var(--space-border)",
          }}
        >
          {editMode && isOwner && (tool === "paint" || tool === "fill") && (
            <div>
              <p
                className="text-xs font-medium mb-2"
                style={{ color: "var(--space-fg-muted)" }}
              >
                지형 팔레트
              </p>
              <div className="grid grid-cols-3 gap-2">
                {TERRAIN.filter((t) => t.id !== 0).map((t) => {
                  const active = terrainId === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setTerrainId(t.id)}
                      className="rounded-lg border p-2 text-xs flex flex-col items-center gap-1"
                      style={{
                        borderColor: active
                          ? "var(--space-accent)"
                          : "var(--space-border)",
                        outline: active
                          ? "2px solid var(--space-accent)"
                          : "none",
                      }}
                    >
                      <span
                        className="block w-7 h-7 rounded"
                        style={{
                          background: t.color,
                          imageRendering: "pixelated",
                        }}
                      />
                      <span style={{ color: "var(--space-fg-muted)" }}>
                        {t.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {editMode && isOwner && tool === "object" && (
            <div>
              <p
                className="text-xs font-medium mb-2"
                style={{ color: "var(--space-fg-muted)" }}
              >
                객체 (선택 후 타일 클릭)
              </p>
              <div className="grid grid-cols-6 gap-1 max-h-72 overflow-auto">
                {OBJECT_EMOJIS.map((em) => (
                  <button
                    key={em}
                    onClick={() => setPendingEmoji(em)}
                    className="text-xl p-1 rounded"
                    style={
                      pendingEmoji === em
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
            </div>
          )}

          {tool === "select" && selMarker && (
            <div>
              <p
                className="text-xs font-medium mb-2"
                style={{ color: "var(--space-fg-muted)" }}
              >
                ✨ 선택된 객체
              </p>
              <label
                className="block text-xs mb-1"
                style={{ color: "var(--space-fg-muted)" }}
              >
                이모지
              </label>
              <input
                type="text"
                value={selMarker.emoji}
                onChange={(e) =>
                  updateSelectedMarker({ emoji: e.target.value })
                }
                disabled={!editMode || !isOwner}
                maxLength={4}
                className="w-full rounded border px-2 py-1 text-xl text-center mb-2"
                style={{
                  background: "var(--space-bg)",
                  borderColor: "var(--space-border)",
                  color: "var(--space-fg)",
                }}
              />
              <label
                className="block text-xs mb-1"
                style={{ color: "var(--space-fg-muted)" }}
              >
                이름 (선택)
              </label>
              <input
                type="text"
                value={selMarker.label ?? ""}
                onChange={(e) =>
                  updateSelectedMarker({ label: e.target.value })
                }
                disabled={!editMode || !isOwner}
                className="w-full rounded border px-2 py-1 text-sm mb-3"
                style={{
                  background: "var(--space-bg)",
                  borderColor: "var(--space-border)",
                  color: "var(--space-fg)",
                }}
              />
              <p
                className="text-xs mb-3"
                style={{ color: "var(--space-fg-soft)" }}
              >
                위치: ({selMarker.x}, {selMarker.y}) · 드래그로 이동
              </p>
              {editMode && isOwner && (
                <button
                  onClick={removeSelectedMarker}
                  className="w-full rounded px-2 py-1 text-xs"
                  style={{
                    background: "rgba(229,91,91,0.15)",
                    color: "#e55b5b",
                  }}
                >
                  객체 삭제
                </button>
              )}
            </div>
          )}

          {(!editMode || !isOwner) && (
            <div
              className="text-sm text-center py-4"
              style={{ color: "var(--space-fg-soft)" }}
            >
              <p className="mb-2">
                {markers.length}개 객체 ·{" "}
                {tiles.filter((t) => t !== 0).length}칸 그려짐
              </p>
              {!editMode && isOwner && (
                <p className="text-xs">편집 모드를 켜면 그릴 수 있어요.</p>
              )}
            </div>
          )}

          {editMode && isOwner && tool === "select" && !selMarker && (
            <p className="text-xs" style={{ color: "var(--space-fg-soft)" }}>
              ✨ 객체 도구로 찍은 마커를 클릭해 선택하세요. 드래그로 이동, 우측에서 이모지·이름 변경.
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}

function ToolBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded px-3 py-1 text-xs"
      style={
        active
          ? { background: "var(--space-accent)", color: "white" }
          : { color: "var(--space-fg-muted)" }
      }
    >
      {children}
    </button>
  );
}
