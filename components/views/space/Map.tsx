"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useSpace } from "@/components/space/SpaceContext";

// ─────────────────────────────────────────────────────────────
//  벡터 맵 에디터 — 영역(폴리곤), 강·길(폴리라인), 마커
// ─────────────────────────────────────────────────────────────

type Vec = { x: number; y: number }; // 0~100 비율 좌표

type Polygon = {
  id: string;
  kind: "polygon";
  points: Vec[];
  color: string;
  label?: string;
};

type Line = {
  id: string;
  kind: "line";
  points: Vec[];
  color: string;
  thickness: number;
  label?: string;
};

type Marker = {
  id: string;
  kind: "marker";
  x: number;
  y: number;
  emoji: string;
  label?: string;
};

type Shape = Polygon | Line | Marker;

type Tool =
  | "select"
  | "area"
  | "rect"
  | "ellipse"
  | "freehand"
  | "river"
  | "marker"
  | "delete";

type MapData = {
  polygons: Polygon[];
  lines: Line[];
  markers: Marker[];
};

const DEFAULT_DATA: MapData = { polygons: [], lines: [], markers: [] };

const AREA_COLORS = [
  "#7cba3d", "#3e8a3e", "#9aa0a6", "#e8d086",
  "#e8b4d8", "#c89968", "#a78bfa", "#f59e0b",
];
const RIVER_COLORS = ["#3490b3", "#1f5e7a", "#74c0e5", "#5a4434", "#9aa0a6"];
const MARKER_EMOJIS = [
  "🌳", "🌲", "🌴", "🌵", "🌸", "🌺", "🌻", "🍄",
  "🌿", "🪴", "🪨", "⛲", "🗿", "🏛️", "🏠", "🏰",
  "⛩️", "🕯️", "🐦", "🦌", "🦊", "🐰", "🦋",
  "✨", "⭐", "🌙", "☀️", "🔥", "❄️", "💧",
];

const newId = () =>
  `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

function buildRectPoints(a: Vec, b: Vec): Vec[] {
  const x1 = Math.min(a.x, b.x);
  const y1 = Math.min(a.y, b.y);
  const x2 = Math.max(a.x, b.x);
  const y2 = Math.max(a.y, b.y);
  return [
    { x: x1, y: y1 },
    { x: x2, y: y1 },
    { x: x2, y: y2 },
    { x: x1, y: y2 },
  ];
}

function buildEllipsePoints(a: Vec, b: Vec, segments = 36): Vec[] {
  const cx = (a.x + b.x) / 2;
  const cy = (a.y + b.y) / 2;
  const rx = Math.abs(b.x - a.x) / 2;
  const ry = Math.abs(b.y - a.y) / 2;
  const pts: Vec[] = [];
  for (let i = 0; i < segments; i++) {
    const t = (i / segments) * Math.PI * 2;
    pts.push({ x: cx + Math.cos(t) * rx, y: cy + Math.sin(t) * ry });
  }
  return pts;
}

export default function SpaceMapView() {
  const { space, isOwner } = useSpace();
  const [data, setData] = useState<MapData>(DEFAULT_DATA);
  const [loading, setLoading] = useState(true);

  const [editMode, setEditMode] = useState(false);
  const [tool, setTool] = useState<Tool>("select");
  const [areaColor, setAreaColor] = useState(AREA_COLORS[0]);
  const [riverColor, setRiverColor] = useState(RIVER_COLORS[0]);
  const [riverThickness, setRiverThickness] = useState(0.8);
  const [pendingEmoji, setPendingEmoji] = useState("🌳");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // 그리는 중인 임시 도형
  const [drawingPoints, setDrawingPoints] = useState<Vec[]>([]);
  const [hoverPoint, setHoverPoint] = useState<Vec | null>(null);
  // rect / ellipse 드래그 그리기
  const [dragShapeStart, setDragShapeStart] = useState<Vec | null>(null);
  const [dragShapeEnd, setDragShapeEnd] = useState<Vec | null>(null);
  // freehand
  const [freehandPoints, setFreehandPoints] = useState<Vec[]>([]);
  const isFreehandingRef = useRef(false);

  // 드래그 중인 도형 정보
  const dragRef = useRef<{
    id: string;
    type: "shape" | "vertex";
    vertexIndex?: number;
    startMouse: Vec;
    startSnapshot: Shape;
  } | null>(null);

  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const sb = supabase();
      const { data: row } = await sb
        .from("garden_settings")
        .select("*")
        .eq("space_id", space.id)
        .eq("key", "map_data")
        .maybeSingle();
      if (!active) return;
      if (row?.value) {
        try {
          const parsed = JSON.parse(row.value);
          setData({
            polygons: Array.isArray(parsed.polygons) ? parsed.polygons : [],
            lines: Array.isArray(parsed.lines) ? parsed.lines : [],
            markers: Array.isArray(parsed.markers) ? parsed.markers : [],
          });
        } catch {}
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [space.id]);

  const persist = useCallback(
    async (next: MapData) => {
      await supabase()
        .from("garden_settings")
        .upsert(
          {
            space_id: space.id,
            key: "map_data",
            value: JSON.stringify(next),
            description: "벡터 맵 데이터",
          },
          { onConflict: "space_id,key" }
        );
    },
    [space.id]
  );

  const saveData = (next: MapData) => {
    setData(next);
    persist(next);
  };

  // ───── 좌표 변환 ─────
  const ptFromEvent = (e: React.MouseEvent | React.PointerEvent): Vec | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    };
  };

  // ───── 그리기 모드 ─────
  const onCanvasMouseDown = (e: React.MouseEvent) => {
    if (!editMode || !isOwner) {
      // 비편집: 선택만
      if (e.target === e.currentTarget) setSelectedId(null);
      return;
    }
    const pt = ptFromEvent(e);
    if (!pt) return;

    if (tool === "area" || tool === "river") {
      // 정점 추가
      // 완료 조건: 폴리곤은 첫 점 근처 클릭 시 닫음
      if (tool === "area" && drawingPoints.length >= 3) {
        const first = drawingPoints[0];
        const dx = pt.x - first.x;
        const dy = pt.y - first.y;
        if (Math.hypot(dx, dy) < 2) {
          finishDrawing();
          return;
        }
      }
      setDrawingPoints((prev) => [...prev, pt]);
      return;
    }

    if (tool === "marker") {
      const m: Marker = {
        id: newId(),
        kind: "marker",
        x: pt.x,
        y: pt.y,
        emoji: pendingEmoji,
      };
      saveData({ ...data, markers: [...data.markers, m] });
      setSelectedId(m.id);
      return;
    }

    if (tool === "rect" || tool === "ellipse") {
      setDragShapeStart(pt);
      setDragShapeEnd(pt);
      return;
    }

    if (tool === "freehand") {
      isFreehandingRef.current = true;
      setFreehandPoints([pt]);
      return;
    }

    if (tool === "select") {
      // 빈 공간 클릭 → 선택 해제
      if (e.target === e.currentTarget) setSelectedId(null);
      return;
    }
  };

  const onCanvasMouseMove = (e: React.MouseEvent) => {
    const pt = ptFromEvent(e);
    if (!pt) return;

    if (editMode && (tool === "area" || tool === "river")) {
      setHoverPoint(pt);
    }

    if (editMode && dragShapeStart && (tool === "rect" || tool === "ellipse")) {
      setDragShapeEnd(pt);
    }

    if (editMode && tool === "freehand" && isFreehandingRef.current) {
      setFreehandPoints((prev) => {
        const last = prev[prev.length - 1];
        if (!last) return [pt];
        // 이전 점과 1.2% 이상 떨어져 있을 때만 기록 — 점 너무 많아지지 않게
        if (Math.hypot(pt.x - last.x, pt.y - last.y) < 1.2) return prev;
        return [...prev, pt];
      });
    }

    if (dragRef.current && editMode) {
      const d = dragRef.current;
      const dx = pt.x - d.startMouse.x;
      const dy = pt.y - d.startMouse.y;

      if (d.type === "shape") {
        const snap = d.startSnapshot;
        if (snap.kind === "marker") {
          setData((prev) => ({
            ...prev,
            markers: prev.markers.map((m) =>
              m.id === d.id
                ? {
                    ...m,
                    x: Math.max(0, Math.min(100, snap.x + dx)),
                    y: Math.max(0, Math.min(100, snap.y + dy)),
                  }
                : m
            ),
          }));
        } else if (snap.kind === "polygon") {
          const newPoints = snap.points.map((p) => ({
            x: Math.max(0, Math.min(100, p.x + dx)),
            y: Math.max(0, Math.min(100, p.y + dy)),
          }));
          setData((prev) => ({
            ...prev,
            polygons: prev.polygons.map((s) =>
              s.id === d.id ? { ...s, points: newPoints } : s
            ),
          }));
        } else if (snap.kind === "line") {
          const newPoints = snap.points.map((p) => ({
            x: Math.max(0, Math.min(100, p.x + dx)),
            y: Math.max(0, Math.min(100, p.y + dy)),
          }));
          setData((prev) => ({
            ...prev,
            lines: prev.lines.map((s) =>
              s.id === d.id ? { ...s, points: newPoints } : s
            ),
          }));
        }
      } else if (d.type === "vertex" && typeof d.vertexIndex === "number") {
        // 꼭짓점 드래그
        const snap = d.startSnapshot;
        if (snap.kind === "polygon" || snap.kind === "line") {
          const idx = d.vertexIndex;
          const newPoints = snap.points.map((p, i) =>
            i === idx
              ? {
                  x: Math.max(0, Math.min(100, pt.x)),
                  y: Math.max(0, Math.min(100, pt.y)),
                }
              : p
          );
          setData((prev) => {
            if (snap.kind === "polygon") {
              return {
                ...prev,
                polygons: prev.polygons.map((s) =>
                  s.id === d.id ? { ...s, points: newPoints } : s
                ),
              };
            }
            return {
              ...prev,
              lines: prev.lines.map((s) =>
                s.id === d.id ? { ...s, points: newPoints } : s
              ),
            };
          });
        }
      }
    }
  };

  const onCanvasMouseUp = () => {
    if (dragRef.current) {
      dragRef.current = null;
      persist(data);
    }

    // 사각형 / 타원 그리기 완료
    if (
      editMode &&
      dragShapeStart &&
      dragShapeEnd &&
      (tool === "rect" || tool === "ellipse")
    ) {
      const w = Math.abs(dragShapeEnd.x - dragShapeStart.x);
      const h = Math.abs(dragShapeEnd.y - dragShapeStart.y);
      if (w >= 1 && h >= 1) {
        const points =
          tool === "rect"
            ? buildRectPoints(dragShapeStart, dragShapeEnd)
            : buildEllipsePoints(dragShapeStart, dragShapeEnd, 36);
        const poly: Polygon = {
          id: newId(),
          kind: "polygon",
          points,
          color: areaColor,
        };
        saveData({ ...data, polygons: [...data.polygons, poly] });
        setSelectedId(poly.id);
      }
      setDragShapeStart(null);
      setDragShapeEnd(null);
      setTool("select");
    }

    // 자유 그리기 완료
    if (editMode && isFreehandingRef.current && tool === "freehand") {
      isFreehandingRef.current = false;
      if (freehandPoints.length >= 3) {
        const poly: Polygon = {
          id: newId(),
          kind: "polygon",
          points: freehandPoints,
          color: areaColor,
        };
        saveData({ ...data, polygons: [...data.polygons, poly] });
        setSelectedId(poly.id);
      }
      setFreehandPoints([]);
      setTool("select");
    }
  };

  // 더블클릭으로 line 도형 완료
  const onCanvasDoubleClick = () => {
    if (!editMode || tool !== "river") return;
    if (drawingPoints.length >= 2) finishDrawing();
  };

  const finishDrawing = () => {
    if (drawingPoints.length === 0) return;
    if (tool === "area") {
      if (drawingPoints.length < 3) {
        setDrawingPoints([]);
        return;
      }
      const poly: Polygon = {
        id: newId(),
        kind: "polygon",
        points: drawingPoints,
        color: areaColor,
      };
      const next = { ...data, polygons: [...data.polygons, poly] };
      saveData(next);
      setSelectedId(poly.id);
    } else if (tool === "river") {
      if (drawingPoints.length < 2) {
        setDrawingPoints([]);
        return;
      }
      const ln: Line = {
        id: newId(),
        kind: "line",
        points: drawingPoints,
        color: riverColor,
        thickness: riverThickness,
      };
      const next = { ...data, lines: [...data.lines, ln] };
      saveData(next);
      setSelectedId(ln.id);
    }
    setDrawingPoints([]);
    setTool("select");
  };

  const cancelDrawing = () => {
    setDrawingPoints([]);
    setHoverPoint(null);
  };

  // ESC로 그리기 취소
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        cancelDrawing();
      } else if (
        e.key === "Enter" &&
        editMode &&
        (tool === "area" || tool === "river")
      ) {
        e.preventDefault();
        finishDrawing();
      } else if (
        (e.key === "Delete" || e.key === "Backspace") &&
        selectedId &&
        editMode
      ) {
        const t = e.target as HTMLElement;
        if (t.tagName === "INPUT" || t.tagName === "TEXTAREA") return;
        deleteShape(selectedId);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editMode, tool, drawingPoints, selectedId, data]);

  // ───── 도형 핸들러 ─────
  const onShapeMouseDown = (
    e: React.MouseEvent,
    shape: Shape
  ) => {
    if (!editMode || !isOwner) {
      setSelectedId(shape.id);
      e.stopPropagation();
      return;
    }
    e.stopPropagation();
    setSelectedId(shape.id);

    if (tool === "delete") {
      deleteShape(shape.id);
      return;
    }
    if (tool !== "select") return;

    const pt = ptFromEvent(e);
    if (!pt) return;
    dragRef.current = {
      id: shape.id,
      type: "shape",
      startMouse: pt,
      startSnapshot: structuredClone(shape),
    };
  };

  const onVertexMouseDown = (
    e: React.MouseEvent,
    shape: Shape,
    idx: number
  ) => {
    if (!editMode || !isOwner) return;
    if (tool !== "select") return;
    e.stopPropagation();
    const pt = ptFromEvent(e);
    if (!pt) return;
    dragRef.current = {
      id: shape.id,
      type: "vertex",
      vertexIndex: idx,
      startMouse: pt,
      startSnapshot: structuredClone(shape),
    };
  };

  const deleteShape = (id: string) => {
    saveData({
      polygons: data.polygons.filter((s) => s.id !== id),
      lines: data.lines.filter((s) => s.id !== id),
      markers: data.markers.filter((s) => s.id !== id),
    });
    setSelectedId(null);
  };

  const updateShape = (id: string, patch: Partial<Shape>) => {
    setData((prev) => {
      const next: MapData = {
        polygons: prev.polygons.map((s) =>
          s.id === id ? ({ ...s, ...patch } as Polygon) : s
        ),
        lines: prev.lines.map((s) =>
          s.id === id ? ({ ...s, ...patch } as Line) : s
        ),
        markers: prev.markers.map((s) =>
          s.id === id ? ({ ...s, ...patch } as Marker) : s
        ),
      };
      persist(next);
      return next;
    });
  };

  const clearMap = () => {
    if (!confirm("맵의 모든 영역·강·마커를 지울까요?")) return;
    saveData({ polygons: [], lines: [], markers: [] });
    setSelectedId(null);
  };

  const selected = useMemo(() => {
    if (!selectedId) return null;
    return (
      data.polygons.find((s) => s.id === selectedId) ??
      data.lines.find((s) => s.id === selectedId) ??
      data.markers.find((s) => s.id === selectedId) ??
      null
    );
  }, [selectedId, data]);

  if (loading)
    return (
      <div className="flex items-center justify-center h-96">
        <p style={{ color: "var(--space-fg-muted)" }}>로딩 중...</p>
      </div>
    );

  // 그리는 중 미리보기 polyline
  const previewPoints =
    drawingPoints.length > 0 && hoverPoint
      ? [...drawingPoints, hoverPoint]
      : drawingPoints;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">🌍 정원 맵</h1>
          <p
            className="text-sm mt-1"
            style={{ color: "var(--space-fg-muted)" }}
          >
            영역을 나누고 강과 길을 그려 직접 지도를 만드세요
          </p>
        </div>
        {isOwner && (
          <div className="flex gap-2">
            <button
              onClick={() => {
                setEditMode((m) => !m);
                setSelectedId(null);
                cancelDrawing();
                setTool("select");
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
                onClick={clearMap}
                className="px-3 py-2 rounded-lg text-xs border"
                style={{
                  borderColor: "rgba(229,91,91,0.5)",
                  color: "#e55b5b",
                }}
              >
                전체 지우기
              </button>
            )}
          </div>
        )}
      </div>

      {/* 도구 모음 */}
      {editMode && isOwner && (
        <div
          className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border p-2 text-sm"
          style={{
            background: "var(--space-card)",
            borderColor: "var(--space-border)",
          }}
        >
          <ToolBtn active={tool === "select"} onClick={() => setTool("select")}>
            ↖ 선택
          </ToolBtn>
          <ToolBtn active={tool === "area"} onClick={() => setTool("area")}>
            ⬡ 영역(다각형)
          </ToolBtn>
          <ToolBtn active={tool === "rect"} onClick={() => setTool("rect")}>
            ▭ 사각형
          </ToolBtn>
          <ToolBtn active={tool === "ellipse"} onClick={() => setTool("ellipse")}>
            ◯ 원/타원
          </ToolBtn>
          <ToolBtn active={tool === "freehand"} onClick={() => setTool("freehand")}>
            ✏️ 자유 그리기
          </ToolBtn>
          <ToolBtn active={tool === "river"} onClick={() => setTool("river")}>
            〰 강·길
          </ToolBtn>
          <ToolBtn active={tool === "marker"} onClick={() => setTool("marker")}>
            ✨ 마커
          </ToolBtn>
          <ToolBtn active={tool === "delete"} onClick={() => setTool("delete")}>
            ✕ 삭제
          </ToolBtn>
          {drawingPoints.length > 0 && (
            <>
              <span
                className="mx-1 h-5 w-px"
                style={{ background: "var(--space-border)" }}
              />
              <span
                className="text-xs"
                style={{ color: "var(--space-fg-soft)" }}
              >
                점 {drawingPoints.length}개
              </span>
              <button
                onClick={finishDrawing}
                className="rounded-full px-3 py-1 text-xs text-white"
                style={{ background: "var(--space-accent)" }}
              >
                완료 (Enter)
              </button>
              <button
                onClick={cancelDrawing}
                className="rounded px-2 py-1 text-xs"
                style={{ color: "var(--space-fg-muted)" }}
              >
                취소 (Esc)
              </button>
            </>
          )}
        </div>
      )}

      <div className="grid lg:grid-cols-[1fr_280px] gap-4">
        {/* 캔버스 */}
        <svg
          ref={svgRef}
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          onMouseDown={onCanvasMouseDown}
          onMouseMove={onCanvasMouseMove}
          onMouseUp={onCanvasMouseUp}
          onMouseLeave={onCanvasMouseUp}
          onDoubleClick={onCanvasDoubleClick}
          className="rounded-2xl border w-full"
          style={{
            aspectRatio: "1 / 1",
            background:
              "radial-gradient(ellipse at center, rgba(74,168,216,0.05) 0%, var(--space-card) 70%)",
            borderColor: "var(--space-border)",
            cursor:
              !editMode || !isOwner
                ? "default"
                : tool === "area" ||
                    tool === "rect" ||
                    tool === "ellipse" ||
                    tool === "freehand" ||
                    tool === "river" ||
                    tool === "marker"
                  ? "crosshair"
                  : tool === "delete"
                    ? "not-allowed"
                    : "default",
            userSelect: "none",
            touchAction: "none",
          }}
        >
          {/* 격자 */}
          <defs>
            <pattern
              id="map-grid"
              width="5"
              height="5"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 5 0 L 0 0 0 5"
                fill="none"
                stroke="rgba(0,0,0,0.04)"
                strokeWidth="0.1"
              />
            </pattern>
          </defs>
          <rect
            x="0"
            y="0"
            width="100"
            height="100"
            fill="url(#map-grid)"
            pointerEvents="none"
          />

          {/* 폴리곤 (영역) */}
          {data.polygons.map((p) => {
            const isSel = selectedId === p.id;
            const ptsStr = p.points.map((pt) => `${pt.x},${pt.y}`).join(" ");
            return (
              <g key={p.id}>
                <polygon
                  points={ptsStr}
                  fill={p.color}
                  fillOpacity={0.35}
                  stroke={p.color}
                  strokeWidth={isSel ? 0.6 : 0.4}
                  strokeLinejoin="round"
                  onMouseDown={(e) => onShapeMouseDown(e, p)}
                  style={{
                    cursor:
                      editMode && tool === "select" ? "move" : "pointer",
                  }}
                />
                {p.label && (
                  <text
                    x={
                      p.points.reduce((s, pt) => s + pt.x, 0) / p.points.length
                    }
                    y={
                      p.points.reduce((s, pt) => s + pt.y, 0) / p.points.length
                    }
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize="2.2"
                    fontWeight="600"
                    fill={p.color}
                    paintOrder="stroke"
                    stroke="rgba(255,255,255,0.85)"
                    strokeWidth="0.6"
                    pointerEvents="none"
                  >
                    {p.label}
                  </text>
                )}
                {/* 꼭짓점 핸들 */}
                {isSel &&
                  editMode &&
                  isOwner &&
                  tool === "select" &&
                  p.points.map((pt, i) => (
                    <circle
                      key={i}
                      cx={pt.x}
                      cy={pt.y}
                      r={0.9}
                      fill="white"
                      stroke={p.color}
                      strokeWidth={0.4}
                      style={{ cursor: "grab" }}
                      onMouseDown={(e) => onVertexMouseDown(e, p, i)}
                    />
                  ))}
              </g>
            );
          })}

          {/* 라인 (강·길) */}
          {data.lines.map((l) => {
            const isSel = selectedId === l.id;
            const ptsStr = l.points.map((pt) => `${pt.x},${pt.y}`).join(" ");
            return (
              <g key={l.id}>
                <polyline
                  points={ptsStr}
                  fill="none"
                  stroke={l.color}
                  strokeWidth={l.thickness + (isSel ? 0.3 : 0)}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  onMouseDown={(e) => onShapeMouseDown(e, l)}
                  style={{
                    cursor:
                      editMode && tool === "select" ? "move" : "pointer",
                  }}
                />
                {/* 클릭 영역 확장용 투명 라인 */}
                <polyline
                  points={ptsStr}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={Math.max(l.thickness + 1.5, 2)}
                  onMouseDown={(e) => onShapeMouseDown(e, l)}
                  style={{
                    cursor:
                      editMode && tool === "select" ? "move" : "pointer",
                  }}
                />
                {isSel &&
                  editMode &&
                  isOwner &&
                  tool === "select" &&
                  l.points.map((pt, i) => (
                    <circle
                      key={i}
                      cx={pt.x}
                      cy={pt.y}
                      r={0.9}
                      fill="white"
                      stroke={l.color}
                      strokeWidth={0.4}
                      style={{ cursor: "grab" }}
                      onMouseDown={(e) => onVertexMouseDown(e, l, i)}
                    />
                  ))}
              </g>
            );
          })}

          {/* 마커 */}
          {data.markers.map((m) => {
            const isSel = selectedId === m.id;
            return (
              <g
                key={m.id}
                onMouseDown={(e) => onShapeMouseDown(e, m)}
                style={{
                  cursor: editMode && tool === "select" ? "move" : "pointer",
                }}
              >
                <text
                  x={m.x}
                  y={m.y + 1.5}
                  textAnchor="middle"
                  fontSize="4"
                  style={{
                    filter: isSel
                      ? "drop-shadow(0 0 0.6px var(--space-accent))"
                      : "drop-shadow(0 0.1px 0.3px rgba(0,0,0,0.3))",
                  }}
                >
                  {m.emoji}
                </text>
              </g>
            );
          })}

          {/* 사각형/타원 드래그 미리보기 */}
          {dragShapeStart && dragShapeEnd && (tool === "rect" || tool === "ellipse") && (
            <g pointerEvents="none">
              {tool === "rect" ? (
                <polygon
                  points={buildRectPoints(dragShapeStart, dragShapeEnd)
                    .map((pt) => `${pt.x},${pt.y}`)
                    .join(" ")}
                  fill={areaColor}
                  fillOpacity={0.18}
                  stroke={areaColor}
                  strokeWidth={0.4}
                  strokeDasharray="0.8 0.4"
                />
              ) : (
                <ellipse
                  cx={(dragShapeStart.x + dragShapeEnd.x) / 2}
                  cy={(dragShapeStart.y + dragShapeEnd.y) / 2}
                  rx={Math.abs(dragShapeEnd.x - dragShapeStart.x) / 2}
                  ry={Math.abs(dragShapeEnd.y - dragShapeStart.y) / 2}
                  fill={areaColor}
                  fillOpacity={0.18}
                  stroke={areaColor}
                  strokeWidth={0.4}
                  strokeDasharray="0.8 0.4"
                />
              )}
            </g>
          )}

          {/* 자유 그리기 미리보기 */}
          {freehandPoints.length > 1 && tool === "freehand" && (
            <polyline
              points={freehandPoints.map((pt) => `${pt.x},${pt.y}`).join(" ")}
              fill={areaColor}
              fillOpacity={0.15}
              stroke={areaColor}
              strokeWidth={0.4}
              strokeLinecap="round"
              strokeLinejoin="round"
              pointerEvents="none"
            />
          )}

          {/* 그리는 중 미리보기 */}
          {drawingPoints.length > 0 && (
            <g pointerEvents="none">
              {tool === "area" ? (
                <polygon
                  points={previewPoints
                    .map((pt) => `${pt.x},${pt.y}`)
                    .join(" ")}
                  fill={areaColor}
                  fillOpacity={0.18}
                  stroke={areaColor}
                  strokeWidth={0.4}
                  strokeDasharray="0.8 0.4"
                />
              ) : (
                <polyline
                  points={previewPoints
                    .map((pt) => `${pt.x},${pt.y}`)
                    .join(" ")}
                  fill="none"
                  stroke={riverColor}
                  strokeWidth={riverThickness}
                  strokeDasharray="0.8 0.4"
                  strokeLinecap="round"
                />
              )}
              {drawingPoints.map((pt, i) => (
                <circle
                  key={i}
                  cx={pt.x}
                  cy={pt.y}
                  r={0.7}
                  fill="white"
                  stroke={tool === "area" ? areaColor : riverColor}
                  strokeWidth={0.3}
                />
              ))}
            </g>
          )}
        </svg>

        {/* 우측 패널 */}
        <aside
          className="rounded-xl p-4 border h-fit space-y-4"
          style={{
            background: "var(--space-card)",
            borderColor: "var(--space-border)",
          }}
        >
          {/* 영역(다각형/사각형/타원/자유 그리기) — 색상 선택 */}
          {editMode &&
            isOwner &&
            (tool === "area" ||
              tool === "rect" ||
              tool === "ellipse" ||
              tool === "freehand") && (
            <div>
              <p
                className="text-xs font-medium mb-2"
                style={{ color: "var(--space-fg-muted)" }}
              >
                영역 색
              </p>
              <div className="flex gap-2 flex-wrap">
                {AREA_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setAreaColor(c)}
                    className="h-7 w-7 rounded-full ring-2"
                    style={{
                      background: c,
                      borderColor: c,
                      outline:
                        areaColor === c
                          ? "2px solid var(--space-accent)"
                          : "none",
                    }}
                  />
                ))}
                <input
                  type="color"
                  value={areaColor}
                  onChange={(e) => setAreaColor(e.target.value)}
                  className="h-7 w-7 cursor-pointer rounded-full"
                  title="직접 색상"
                />
              </div>
              <p
                className="mt-3 text-xs"
                style={{ color: "var(--space-fg-soft)" }}
              >
                {tool === "area" &&
                  "캔버스를 클릭해 점을 찍고, 첫 점 근처를 다시 클릭하거나 Enter로 닫아요."}
                {tool === "rect" &&
                  "캔버스에서 클릭-드래그로 사각형을 그려요."}
                {tool === "ellipse" &&
                  "캔버스에서 클릭-드래그로 원/타원을 그려요. (정원은 같은 가로·세로)"}
                {tool === "freehand" &&
                  "마우스 버튼을 누른 채로 자유롭게 그려요. 떼면 그 모양으로 영역이 생성돼요."}
              </p>
            </div>
          )}

          {/* 강·길 도구 */}
          {editMode && isOwner && tool === "river" && (
            <div>
              <p
                className="text-xs font-medium mb-2"
                style={{ color: "var(--space-fg-muted)" }}
              >
                강·길 색
              </p>
              <div className="flex gap-2 flex-wrap mb-3">
                {RIVER_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setRiverColor(c)}
                    className="h-7 w-7 rounded-full"
                    style={{
                      background: c,
                      outline:
                        riverColor === c
                          ? "2px solid var(--space-accent)"
                          : "none",
                    }}
                  />
                ))}
                <input
                  type="color"
                  value={riverColor}
                  onChange={(e) => setRiverColor(e.target.value)}
                  className="h-7 w-7 cursor-pointer rounded-full"
                />
              </div>
              <label
                className="block text-xs mb-1"
                style={{ color: "var(--space-fg-muted)" }}
              >
                굵기 ({riverThickness.toFixed(1)})
              </label>
              <input
                type="range"
                min={0.3}
                max={3}
                step={0.1}
                value={riverThickness}
                onChange={(e) =>
                  setRiverThickness(parseFloat(e.target.value))
                }
                className="w-full mb-2"
              />
              <p
                className="text-xs"
                style={{ color: "var(--space-fg-soft)" }}
              >
                점을 찍어 경로를 만들고 Enter 또는 더블클릭으로 마무리.
              </p>
            </div>
          )}

          {/* 마커 도구 */}
          {editMode && isOwner && tool === "marker" && (
            <div>
              <p
                className="text-xs font-medium mb-2"
                style={{ color: "var(--space-fg-muted)" }}
              >
                마커 (선택 후 캔버스 클릭)
              </p>
              <div className="grid grid-cols-6 gap-1 max-h-72 overflow-auto">
                {MARKER_EMOJIS.map((em) => (
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

          {/* 선택된 도형 속성 */}
          {selected && (
            <div
              className="space-y-2 pt-3"
              style={{
                borderTop:
                  tool === "select" ? "none" : "1px solid var(--space-border)",
              }}
            >
              <p
                className="text-xs font-medium"
                style={{ color: "var(--space-fg-muted)" }}
              >
                {selected.kind === "polygon"
                  ? "⬡ 영역"
                  : selected.kind === "line"
                    ? "〰 강·길"
                    : "✨ 마커"}{" "}
                속성
              </p>
              {selected.kind === "marker" && (
                <>
                  <label
                    className="block text-xs"
                    style={{ color: "var(--space-fg-muted)" }}
                  >
                    이모지
                  </label>
                  <input
                    type="text"
                    value={selected.emoji}
                    onChange={(e) =>
                      updateShape(selected.id, { emoji: e.target.value })
                    }
                    disabled={!editMode || !isOwner}
                    maxLength={4}
                    className="w-full rounded border px-2 py-1 text-xl text-center"
                    style={{
                      background: "var(--space-bg)",
                      borderColor: "var(--space-border)",
                      color: "var(--space-fg)",
                    }}
                  />
                </>
              )}
              <label
                className="block text-xs"
                style={{ color: "var(--space-fg-muted)" }}
              >
                이름 (선택)
              </label>
              <input
                type="text"
                value={selected.label ?? ""}
                onChange={(e) =>
                  updateShape(selected.id, { label: e.target.value } as Partial<Shape>)
                }
                disabled={!editMode || !isOwner}
                className="w-full rounded border px-2 py-1 text-sm"
                style={{
                  background: "var(--space-bg)",
                  borderColor: "var(--space-border)",
                  color: "var(--space-fg)",
                }}
              />
              {(selected.kind === "polygon" || selected.kind === "line") && (
                <>
                  <label
                    className="block text-xs"
                    style={{ color: "var(--space-fg-muted)" }}
                  >
                    색상
                  </label>
                  <input
                    type="color"
                    value={selected.color}
                    onChange={(e) =>
                      updateShape(selected.id, {
                        color: e.target.value,
                      } as Partial<Shape>)
                    }
                    disabled={!editMode || !isOwner}
                    className="h-8 w-16 cursor-pointer rounded"
                  />
                </>
              )}
              {selected.kind === "line" && (
                <>
                  <label
                    className="block text-xs"
                    style={{ color: "var(--space-fg-muted)" }}
                  >
                    굵기 ({selected.thickness.toFixed(1)})
                  </label>
                  <input
                    type="range"
                    min={0.3}
                    max={3}
                    step={0.1}
                    value={selected.thickness}
                    onChange={(e) =>
                      updateShape(selected.id, {
                        thickness: parseFloat(e.target.value),
                      } as Partial<Shape>)
                    }
                    disabled={!editMode || !isOwner}
                    className="w-full"
                  />
                </>
              )}
              {editMode && isOwner && (
                <button
                  onClick={() => deleteShape(selected.id)}
                  className="w-full rounded px-2 py-1 text-xs"
                  style={{
                    background: "rgba(229,91,91,0.15)",
                    color: "#e55b5b",
                  }}
                >
                  삭제
                </button>
              )}
            </div>
          )}

          {!selected && tool === "select" && (
            <div
              className="text-sm text-center py-4"
              style={{ color: "var(--space-fg-soft)" }}
            >
              <p className="mb-2">
                영역 {data.polygons.length} · 강·길 {data.lines.length} · 마커{" "}
                {data.markers.length}
              </p>
              {editMode && isOwner && (
                <p className="text-xs">
                  도형을 클릭해 선택하면 색·이름·꼭짓점을 편집할 수 있어요.
                </p>
              )}
            </div>
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
