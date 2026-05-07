"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useSpace } from "@/components/space/SpaceContext";

// =============================================================
//  파워포인트 스타일 맵 에디터
//   - 각 도형은 독립 객체 (이동·리사이즈·회전·z-order)
//   - 도형: 사각형/원/삼각형/별/선/화살표/텍스트/아이콘
//   - 선택 시 8방향 핸들 + 회전 핸들
//   - 우측 속성 패널 — 색·테두리·투명도·정렬·크기·삭제·복제
//   - 배경색/격자/줌·팬/Undo·Redo
// =============================================================

const CANVAS_W = 1280;
const CANVAS_H = 800;
const HISTORY_MAX = 60;

type ShapeKind =
  | "rect"
  | "ellipse"
  | "triangle"
  | "star"
  | "line"
  | "arrow"
  | "text"
  | "icon";

type Shape = {
  id: string;
  kind: ShapeKind;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  opacity: number;
  z: number;
  // 도형별 추가 속성
  rx?: number;
  starPoints?: number;
  text?: string;
  fontSize?: number;
  fontWeight?: number;
  textColor?: string;
  emoji?: string;
};

type Tool =
  | "select"
  | "rect"
  | "ellipse"
  | "triangle"
  | "star"
  | "line"
  | "arrow"
  | "text"
  | "icon";

type DragMode =
  | "move"
  | "resize-tl" | "resize-tr" | "resize-bl" | "resize-br"
  | "resize-t" | "resize-b" | "resize-l" | "resize-r"
  | "rotate"
  | "draw"
  | "pan";

type DragState = {
  mode: DragMode;
  shapeId?: string;
  startMouse: { x: number; y: number };
  startSnap?: Shape;
  // pan
  vbStart?: { x: number; y: number };
};

type Snap = { shapes: Shape[]; bg: string };

const newId = () =>
  `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const PRESET_FILLS = [
  "#7cba3d", "#3490b3", "#e8d086", "#9aa0a6", "#a64242",
  "#c89968", "#5a4434", "#e8b4d8", "#a78bfa", "#f7c873",
  "#1e3a5f", "#ffffff", "#e55b5b",
];
const PRESET_STROKES = [
  "transparent", "#1e3a5f", "#ffffff", "#000000", "#5a4434",
];
const ICON_EMOJIS = [
  "🏠", "🏰", "⛺", "⛩️", "🛖", "🏛️", "🌳", "🌲",
  "🌴", "🌵", "🍄", "🌸", "🪨", "⛲", "🗿", "🏞️",
  "🌋", "🏔️", "⛰️", "🏝️", "🌊", "💎", "⚔️", "🏹",
  "🧙", "👤", "🐉", "🦊", "🐺", "🦌", "🐎", "🦅",
  "✨", "⭐", "🔥", "❄️", "💧", "🌙", "☀️", "📜",
];

// ─── 도형 생성 헬퍼 ───
function makeShape(kind: ShapeKind, x: number, y: number, w: number, h: number, z: number, fill = "#7cba3d"): Shape {
  const base: Shape = {
    id: newId(),
    kind,
    x,
    y,
    w: Math.max(2, w),
    h: Math.max(2, h),
    rotation: 0,
    fill,
    stroke: "#1e3a5f",
    strokeWidth: 1,
    opacity: 1,
    z,
  };
  if (kind === "rect") base.rx = 0;
  if (kind === "star") base.starPoints = 5;
  if (kind === "line" || kind === "arrow") {
    base.fill = "transparent";
    base.stroke = "#1e3a5f";
    base.strokeWidth = 3;
  }
  if (kind === "text") {
    base.text = "텍스트";
    base.fontSize = 24;
    base.fontWeight = 600;
    base.textColor = "#1e3a5f";
    base.fill = "transparent";
    base.stroke = "transparent";
  }
  if (kind === "icon") {
    base.emoji = "🏠";
    base.fill = "transparent";
    base.stroke = "transparent";
  }
  return base;
}

// 별 path (n개 꼭짓점)
function starPath(cx: number, cy: number, rOuter: number, rInner: number, n: number) {
  const pts: string[] = [];
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 === 0 ? rOuter : rInner;
    const a = -Math.PI / 2 + (i * Math.PI) / n;
    pts.push(`${cx + Math.cos(a) * r},${cy + Math.sin(a) * r}`);
  }
  return `M${pts.join("L")}Z`;
}

export default function SpaceMapView() {
  const { space, isOwner } = useSpace();
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [bg, setBg] = useState("#f0f7ff");
  const [loading, setLoading] = useState(true);

  const [tool, setTool] = useState<Tool>("select");
  const [editMode, setEditMode] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showGrid, setShowGrid] = useState(true);
  const [snapToGrid, setSnapToGrid] = useState(false);
  const gridSize = 20;

  // 줌·팬
  const [vb, setVb] = useState({ x: 0, y: 0, w: CANVAS_W, h: CANVAS_H });

  // 드래그
  const [drag, setDrag] = useState<DragState | null>(null);
  // 그리는 중
  const [drawing, setDrawing] = useState<{
    kind: ShapeKind;
    start: { x: number; y: number };
    current: { x: number; y: number };
  } | null>(null);

  // 히스토리
  const [past, setPast] = useState<Snap[]>([]);
  const [future, setFuture] = useState<Snap[]>([]);

  const svgRef = useRef<SVGSVGElement | null>(null);

  // ─── 초기 로드 ───
  useEffect(() => {
    let active = true;
    (async () => {
      const sb = supabase();
      const { data: row } = await sb
        .from("garden_settings")
        .select("*")
        .eq("space_id", space.id)
        .eq("key", "map_shapes")
        .maybeSingle();
      if (!active) return;
      if (row?.value) {
        try {
          const parsed = JSON.parse(row.value);
          if (Array.isArray(parsed.shapes)) {
            setShapes(parsed.shapes);
          }
          if (typeof parsed.bg === "string") setBg(parsed.bg);
        } catch {}
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [space.id]);

  const persist = useCallback(
    async (next: { shapes: Shape[]; bg: string }) => {
      const sb = supabase();
      const value = JSON.stringify(next);
      const { data: existing } = await sb
        .from("garden_settings")
        .select("id")
        .eq("space_id", space.id)
        .eq("key", "map_shapes")
        .maybeSingle();
      if (existing) {
        await sb.from("garden_settings").update({ value }).eq("id", existing.id);
      } else {
        await sb.from("garden_settings").insert({
          space_id: space.id,
          key: "map_shapes",
          value,
          description: "벡터 맵 도형",
        });
      }
    },
    [space.id]
  );

  const save = (nextShapes?: Shape[], nextBg?: string) => {
    const s = nextShapes ?? shapes;
    const b = nextBg ?? bg;
    persist({ shapes: s, bg: b });
  };

  // ─── 히스토리 ───
  const pushHistory = () => {
    const cur: Snap = { shapes: shapes.map((s) => ({ ...s })), bg };
    setPast((p) => {
      const next = p.length >= HISTORY_MAX ? p.slice(1) : p.slice();
      next.push(cur);
      return next;
    });
    setFuture([]);
  };
  const undo = () => {
    if (past.length === 0) return;
    const target = past[past.length - 1];
    const cur: Snap = { shapes: shapes.map((s) => ({ ...s })), bg };
    setPast(past.slice(0, -1));
    setFuture((f) => [...f, cur]);
    setShapes(target.shapes);
    setBg(target.bg);
    persist(target);
    setSelectedId(null);
  };
  const redo = () => {
    if (future.length === 0) return;
    const target = future[future.length - 1];
    const cur: Snap = { shapes: shapes.map((s) => ({ ...s })), bg };
    setFuture(future.slice(0, -1));
    setPast((p) => [...p, cur]);
    setShapes(target.shapes);
    setBg(target.bg);
    persist(target);
    setSelectedId(null);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      const meta = e.ctrlKey || e.metaKey;
      if (meta && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((meta && e.key.toLowerCase() === "y") || (meta && e.shiftKey && e.key.toLowerCase() === "z")) {
        e.preventDefault();
        redo();
      } else if ((e.key === "Delete" || e.key === "Backspace") && selectedId && editMode) {
        e.preventDefault();
        deleteSelected();
      } else if (meta && e.key.toLowerCase() === "d" && selectedId) {
        e.preventDefault();
        duplicateSelected();
      } else if (e.key === "Escape") {
        setSelectedId(null);
        setDrawing(null);
        setTool("select");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [past, future, shapes, bg, selectedId, editMode]);

  // ─── 좌표 변환 ───
  const ptFromEvent = (e: React.MouseEvent | React.WheelEvent): { x: number; y: number } => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const m = pt.matrixTransform(ctm.inverse());
    return { x: m.x, y: m.y };
  };

  const snap = (v: number) => (snapToGrid ? Math.round(v / gridSize) * gridSize : v);

  // ─── 도형 작업 ───
  const selectedShape = useMemo(
    () => shapes.find((s) => s.id === selectedId) ?? null,
    [shapes, selectedId]
  );

  const updateShape = (id: string, patch: Partial<Shape>, persistNow = true) => {
    setShapes((prev) => {
      const next = prev.map((s) => (s.id === id ? { ...s, ...patch } : s));
      if (persistNow) persist({ shapes: next, bg });
      return next;
    });
  };

  const deleteSelected = () => {
    if (!selectedId) return;
    pushHistory();
    const next = shapes.filter((s) => s.id !== selectedId);
    setShapes(next);
    persist({ shapes: next, bg });
    setSelectedId(null);
  };

  const duplicateSelected = () => {
    if (!selectedShape) return;
    pushHistory();
    const maxZ = Math.max(0, ...shapes.map((s) => s.z));
    const dup: Shape = {
      ...selectedShape,
      id: newId(),
      x: selectedShape.x + 16,
      y: selectedShape.y + 16,
      z: maxZ + 1,
    };
    const next = [...shapes, dup];
    setShapes(next);
    persist({ shapes: next, bg });
    setSelectedId(dup.id);
  };

  const reorder = (id: string, delta: "front" | "back" | "forward" | "backward") => {
    const sorted = [...shapes].sort((a, b) => a.z - b.z);
    const idx = sorted.findIndex((s) => s.id === id);
    if (idx < 0) return;
    pushHistory();
    if (delta === "front") {
      const max = sorted[sorted.length - 1].z;
      updateShape(id, { z: max + 1 });
    } else if (delta === "back") {
      const min = sorted[0].z;
      updateShape(id, { z: min - 1 });
    } else if (delta === "forward" && idx < sorted.length - 1) {
      const a = sorted[idx];
      const b = sorted[idx + 1];
      const next = shapes.map((s) =>
        s.id === a.id ? { ...s, z: b.z } : s.id === b.id ? { ...s, z: a.z } : s
      );
      setShapes(next);
      persist({ shapes: next, bg });
    } else if (delta === "backward" && idx > 0) {
      const a = sorted[idx];
      const b = sorted[idx - 1];
      const next = shapes.map((s) =>
        s.id === a.id ? { ...s, z: b.z } : s.id === b.id ? { ...s, z: a.z } : s
      );
      setShapes(next);
      persist({ shapes: next, bg });
    }
  };

  // ─── 마우스 핸들러 ───
  const onCanvasMouseDown = (e: React.MouseEvent) => {
    // 가운데 버튼 → 패닝
    if (e.button === 1) {
      e.preventDefault();
      const pt = ptFromEvent(e);
      setDrag({
        mode: "pan",
        startMouse: pt,
        vbStart: { x: vb.x, y: vb.y },
      });
      return;
    }
    if (!editMode || !isOwner) return;

    const pt = ptFromEvent(e);

    // 도형 그리기 도구
    if (tool !== "select") {
      const clamped = { x: snap(pt.x), y: snap(pt.y) };
      setDrawing({
        kind: tool as ShapeKind,
        start: clamped,
        current: clamped,
      });
      return;
    }

    // 빈 공간 클릭 → 선택 해제
    if (e.target === e.currentTarget) {
      setSelectedId(null);
    }
  };

  const onCanvasMouseMove = (e: React.MouseEvent) => {
    if (drag?.mode === "pan") {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const sx = vb.w / rect.width;
      const sy = vb.h / rect.height;
      setVb((v) => ({
        ...v,
        x: drag.vbStart!.x - (e.clientX - 0) * sx + (drag.startMouse.x * sx + drag.vbStart!.x) * 0,
      }));
      // 더 단순하게:
      const dx = (drag.startMouse.x - ptFromEventNoVB(e, vb, svg).x);
      const dy = (drag.startMouse.y - ptFromEventNoVB(e, vb, svg).y);
      setVb((v) => ({ ...v, x: drag.vbStart!.x + dx, y: drag.vbStart!.y + dy }));
      return;
    }

    const pt = ptFromEvent(e);

    if (drawing) {
      setDrawing({ ...drawing, current: { x: snap(pt.x), y: snap(pt.y) } });
      return;
    }

    if (drag && drag.shapeId && drag.startSnap) {
      const dx = pt.x - drag.startMouse.x;
      const dy = pt.y - drag.startMouse.y;
      const s = drag.startSnap;

      if (drag.mode === "move") {
        updateShape(s.id, { x: snap(s.x + dx), y: snap(s.y + dy) }, false);
      } else if (drag.mode === "rotate") {
        const cx = s.x + s.w / 2;
        const cy = s.y + s.h / 2;
        const a = (Math.atan2(pt.y - cy, pt.x - cx) * 180) / Math.PI + 90;
        updateShape(s.id, { rotation: Math.round(a) }, false);
      } else if (drag.mode.startsWith("resize")) {
        let nx = s.x;
        let ny = s.y;
        let nw = s.w;
        let nh = s.h;
        if (drag.mode === "resize-r" || drag.mode === "resize-tr" || drag.mode === "resize-br") {
          nw = Math.max(8, s.w + dx);
        }
        if (drag.mode === "resize-l" || drag.mode === "resize-tl" || drag.mode === "resize-bl") {
          nw = Math.max(8, s.w - dx);
          nx = s.x + (s.w - nw);
        }
        if (drag.mode === "resize-b" || drag.mode === "resize-bl" || drag.mode === "resize-br") {
          nh = Math.max(8, s.h + dy);
        }
        if (drag.mode === "resize-t" || drag.mode === "resize-tl" || drag.mode === "resize-tr") {
          nh = Math.max(8, s.h - dy);
          ny = s.y + (s.h - nh);
        }
        updateShape(s.id, { x: snap(nx), y: snap(ny), w: snap(nw), h: snap(nh) }, false);
      }
    }
  };

  const onCanvasMouseUp = () => {
    if (drag?.mode === "pan") {
      setDrag(null);
      return;
    }
    if (drag) {
      // 드래그 마무리 — 최종 상태 저장
      persist({ shapes, bg });
      setDrag(null);
      return;
    }
    if (drawing) {
      const w = Math.abs(drawing.current.x - drawing.start.x);
      const h = Math.abs(drawing.current.y - drawing.start.y);
      if (w >= 4 && h >= 4) {
        pushHistory();
        const x = Math.min(drawing.start.x, drawing.current.x);
        const y = Math.min(drawing.start.y, drawing.current.y);
        const maxZ = Math.max(0, ...shapes.map((s) => s.z));
        let shape = makeShape(drawing.kind, x, y, w, h, maxZ + 1);
        if (drawing.kind === "text") {
          shape.text = window.prompt("텍스트 입력", "텍스트") ?? "텍스트";
        }
        if (drawing.kind === "icon") {
          shape.emoji = window.prompt("이모지 입력", "🏠") ?? "🏠";
        }
        const next = [...shapes, shape];
        setShapes(next);
        persist({ shapes: next, bg });
        setSelectedId(shape.id);
      }
      setDrawing(null);
      setTool("select");
    }
  };

  const onShapeMouseDown = (e: React.MouseEvent, s: Shape) => {
    if (!editMode || !isOwner || tool !== "select") {
      setSelectedId(s.id);
      return;
    }
    e.stopPropagation();
    setSelectedId(s.id);
    pushHistory();
    setDrag({
      mode: "move",
      shapeId: s.id,
      startMouse: ptFromEvent(e),
      startSnap: { ...s },
    });
  };

  const onHandleMouseDown = (e: React.MouseEvent, s: Shape, mode: DragMode) => {
    if (!editMode || !isOwner) return;
    e.stopPropagation();
    pushHistory();
    setDrag({
      mode,
      shapeId: s.id,
      startMouse: ptFromEvent(e),
      startSnap: { ...s },
    });
  };

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const pt = ptFromEvent(e);
    const factor = e.deltaY > 0 ? 1.15 : 1 / 1.15;
    const newW = Math.max(100, Math.min(CANVAS_W * 4, vb.w * factor));
    const newH = Math.max(100, Math.min(CANVAS_H * 4, vb.h * factor));
    const ratio = newW / vb.w;
    setVb({
      x: pt.x - (pt.x - vb.x) * ratio,
      y: pt.y - (pt.y - vb.y) * ratio,
      w: newW,
      h: newH,
    });
  };

  const resetView = () => setVb({ x: 0, y: 0, w: CANVAS_W, h: CANVAS_H });

  // ─── 그리는 중 미리보기 박스 ───
  const drawingPreview = useMemo(() => {
    if (!drawing) return null;
    const x = Math.min(drawing.start.x, drawing.current.x);
    const y = Math.min(drawing.start.y, drawing.current.y);
    const w = Math.abs(drawing.current.x - drawing.start.x);
    const h = Math.abs(drawing.current.y - drawing.start.y);
    return { x, y, w, h, kind: drawing.kind };
  }, [drawing]);

  if (loading)
    return (
      <div className="flex items-center justify-center h-96">
        <p style={{ color: "var(--space-fg-muted)" }}>로딩 중...</p>
      </div>
    );

  const cursor =
    drag?.mode === "pan"
      ? "grabbing"
      : !editMode || !isOwner
        ? "default"
        : tool === "select"
          ? "default"
          : "crosshair";

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold">🌍 정원 맵 — 슬라이드 에디터</h1>
          <p className="text-sm mt-1" style={{ color: "var(--space-fg-muted)" }}>
            도형 {shapes.length}개 · 자유 배치 · 회전·리사이즈
          </p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <div
            className="flex items-center gap-1 rounded-lg border px-1.5 py-1 text-xs"
            style={{
              borderColor: "var(--space-border)",
              background: "var(--space-card)",
              color: "var(--space-fg-muted)",
            }}
          >
            <button onClick={() => setVb((v) => ({ ...v, w: v.w / 1.2, h: v.h / 1.2 }))} className="px-1.5">⊕</button>
            <button onClick={() => setVb((v) => ({ ...v, w: v.w * 1.2, h: v.h * 1.2 }))} className="px-1.5">⊖</button>
            <button onClick={resetView} className="px-1.5">⤢</button>
          </div>
          {isOwner && (
            <button
              onClick={() => {
                setEditMode((m) => !m);
                setSelectedId(null);
                setTool("select");
                setDrawing(null);
              }}
              className="px-4 py-2 rounded-lg text-sm font-medium text-white"
              style={{ background: editMode ? "#e8a63a" : "var(--space-accent)" }}
            >
              {editMode ? "✓ 편집 종료" : "✎ 편집 모드"}
            </button>
          )}
        </div>
      </div>

      {/* 도구 모음 */}
      {editMode && isOwner && (
        <div
          className="mb-3 flex flex-wrap items-center gap-1.5 rounded-lg border p-2 text-sm"
          style={{
            background: "var(--space-card)",
            borderColor: "var(--space-border)",
          }}
        >
          <ToolBtn active={tool === "select"} onClick={() => setTool("select")}>↖ 선택</ToolBtn>
          <span className="mx-1 h-5 w-px" style={{ background: "var(--space-border)" }} />
          <ToolBtn active={tool === "rect"} onClick={() => setTool("rect")}>▭ 사각</ToolBtn>
          <ToolBtn active={tool === "ellipse"} onClick={() => setTool("ellipse")}>◯ 원</ToolBtn>
          <ToolBtn active={tool === "triangle"} onClick={() => setTool("triangle")}>▲ 삼각</ToolBtn>
          <ToolBtn active={tool === "star"} onClick={() => setTool("star")}>⭐ 별</ToolBtn>
          <ToolBtn active={tool === "line"} onClick={() => setTool("line")}>─ 선</ToolBtn>
          <ToolBtn active={tool === "arrow"} onClick={() => setTool("arrow")}>➡ 화살표</ToolBtn>
          <ToolBtn active={tool === "text"} onClick={() => setTool("text")}>📝 텍스트</ToolBtn>
          <ToolBtn active={tool === "icon"} onClick={() => setTool("icon")}>🎨 아이콘</ToolBtn>
          <span className="mx-1 h-5 w-px" style={{ background: "var(--space-border)" }} />
          <button
            onClick={() => setShowGrid((g) => !g)}
            className="rounded px-2 py-1 text-xs"
            style={{
              background: showGrid ? "var(--space-accent-soft)" : "transparent",
              color: showGrid ? "var(--space-accent)" : "var(--space-fg-muted)",
            }}
          >
            # 격자
          </button>
          <button
            onClick={() => setSnapToGrid((s) => !s)}
            className="rounded px-2 py-1 text-xs"
            style={{
              background: snapToGrid ? "var(--space-accent-soft)" : "transparent",
              color: snapToGrid ? "var(--space-accent)" : "var(--space-fg-muted)",
            }}
          >
            🧲 스냅
          </button>
          <span className="mx-1 h-5 w-px" style={{ background: "var(--space-border)" }} />
          <label className="flex items-center gap-1 text-xs" style={{ color: "var(--space-fg-muted)" }}>
            배경
            <input
              type="color"
              value={bg}
              onChange={(e) => {
                const nb = e.target.value;
                setBg(nb);
                save(undefined, nb);
              }}
              className="h-6 w-7 cursor-pointer rounded"
            />
          </label>
          <span className="mx-1 h-5 w-px" style={{ background: "var(--space-border)" }} />
          <button
            onClick={undo}
            disabled={past.length === 0}
            className="rounded px-2 py-1 text-xs disabled:opacity-30"
            style={{ color: "var(--space-fg-muted)" }}
            title="되돌리기 (Ctrl+Z)"
          >
            ↶ 되돌리기
          </button>
          <button
            onClick={redo}
            disabled={future.length === 0}
            className="rounded px-2 py-1 text-xs disabled:opacity-30"
            style={{ color: "var(--space-fg-muted)" }}
            title="다시 (Ctrl+Y)"
          >
            ↷ 다시
          </button>
        </div>
      )}

      <div className="grid lg:grid-cols-[1fr_300px] gap-4">
        {/* 캔버스 */}
        <div
          className="relative overflow-hidden rounded-2xl border w-full"
          style={{
            aspectRatio: `${CANVAS_W} / ${CANVAS_H}`,
            maxHeight: "calc(100vh - 240px)",
            background: bg,
            borderColor: "var(--space-border)",
          }}
        >
          <svg
            ref={svgRef}
            viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
            preserveAspectRatio="xMidYMid meet"
            onMouseDown={onCanvasMouseDown}
            onMouseMove={onCanvasMouseMove}
            onMouseUp={onCanvasMouseUp}
            onMouseLeave={onCanvasMouseUp}
            onWheel={onWheel}
            onContextMenu={(e) => e.preventDefault()}
            style={{
              width: "100%",
              height: "100%",
              cursor,
              userSelect: "none",
              touchAction: "none",
              display: "block",
            }}
          >
            <defs>
              <pattern id="m-grid" width={gridSize} height={gridSize} patternUnits="userSpaceOnUse">
                <path
                  d={`M ${gridSize} 0 L 0 0 0 ${gridSize}`}
                  fill="none"
                  stroke="rgba(0,0,0,0.06)"
                  strokeWidth={0.5}
                />
              </pattern>
              <marker
                id="arrowhead"
                markerWidth="10"
                markerHeight="10"
                refX="8"
                refY="3.5"
                orient="auto"
              >
                <polygon points="0 0, 10 3.5, 0 7" fill="currentColor" />
              </marker>
            </defs>
            {showGrid && (
              <rect
                x={vb.x}
                y={vb.y}
                width={vb.w}
                height={vb.h}
                fill="url(#m-grid)"
                pointerEvents="none"
              />
            )}
            {/* 캔버스 경계 */}
            <rect
              x={0}
              y={0}
              width={CANVAS_W}
              height={CANVAS_H}
              fill="none"
              stroke="rgba(74,168,216,0.4)"
              strokeWidth={2}
              strokeDasharray="6 4"
              pointerEvents="none"
            />

            {/* 도형 (z 순서대로) */}
            {[...shapes]
              .sort((a, b) => a.z - b.z)
              .map((s) => (
                <ShapeNode
                  key={s.id}
                  shape={s}
                  selected={selectedId === s.id}
                  onMouseDown={(e) => onShapeMouseDown(e, s)}
                />
              ))}

            {/* 선택 핸들 */}
            {selectedShape && editMode && isOwner && (
              <SelectionHandles
                shape={selectedShape}
                onHandleDown={onHandleMouseDown}
              />
            )}

            {/* 그리는 중 미리보기 */}
            {drawingPreview && (
              <DrawingPreview {...drawingPreview} />
            )}
          </svg>
        </div>

        {/* 우측 속성 패널 */}
        <aside
          className="rounded-xl p-4 border h-fit space-y-3"
          style={{
            background: "var(--space-card)",
            borderColor: "var(--space-border)",
          }}
        >
          {selectedShape && editMode && isOwner ? (
            <PropertyPanel
              shape={selectedShape}
              onUpdate={(p) => {
                pushHistory();
                updateShape(selectedShape.id, p);
              }}
              onDelete={deleteSelected}
              onDuplicate={duplicateSelected}
              onReorder={(d) => reorder(selectedShape.id, d)}
            />
          ) : editMode && isOwner && tool !== "select" ? (
            <div>
              <p
                className="text-xs font-medium mb-2"
                style={{ color: "var(--space-fg-muted)" }}
              >
                {toolLabel(tool)} 도구
              </p>
              <p
                className="text-xs"
                style={{ color: "var(--space-fg-soft)" }}
              >
                캔버스에서 클릭·드래그로 도형을 그려요. Esc로 취소.
              </p>
            </div>
          ) : (
            <div
              className="text-sm text-center py-6"
              style={{ color: "var(--space-fg-soft)" }}
            >
              <p className="mb-2">도형 {shapes.length}개</p>
              {!editMode && isOwner && <p className="text-xs">편집 모드를 켜면 그릴 수 있어요</p>}
              {editMode && isOwner && (
                <p className="text-xs">
                  도형을 클릭해 선택하거나, 위에서 도구를 골라 새로 그리세요.<br />
                  Ctrl+Z 되돌리기 · Ctrl+D 복제 · Delete 삭제 · Esc 해제
                </p>
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

// ─── 헬퍼: 좌표 (단순) ───
function ptFromEventNoVB(
  e: React.MouseEvent,
  vb: { x: number; y: number; w: number; h: number },
  svg: SVGSVGElement
): { x: number; y: number } {
  const rect = svg.getBoundingClientRect();
  return {
    x: vb.x + ((e.clientX - rect.left) / rect.width) * vb.w,
    y: vb.y + ((e.clientY - rect.top) / rect.height) * vb.h,
  };
}

// ─── 도형 렌더 ───
function ShapeNode({
  shape,
  selected,
  onMouseDown,
}: {
  shape: Shape;
  selected: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
}) {
  const cx = shape.x + shape.w / 2;
  const cy = shape.y + shape.h / 2;
  const transform = `rotate(${shape.rotation} ${cx} ${cy})`;

  const common = {
    onMouseDown,
    style: {
      cursor: selected ? "move" : "pointer",
      opacity: shape.opacity,
    } as React.CSSProperties,
  };

  switch (shape.kind) {
    case "rect":
      return (
        <rect
          x={shape.x}
          y={shape.y}
          width={shape.w}
          height={shape.h}
          rx={shape.rx ?? 0}
          ry={shape.rx ?? 0}
          fill={shape.fill}
          stroke={shape.stroke}
          strokeWidth={shape.strokeWidth}
          transform={transform}
          {...common}
        />
      );
    case "ellipse":
      return (
        <ellipse
          cx={cx}
          cy={cy}
          rx={shape.w / 2}
          ry={shape.h / 2}
          fill={shape.fill}
          stroke={shape.stroke}
          strokeWidth={shape.strokeWidth}
          transform={transform}
          {...common}
        />
      );
    case "triangle":
      return (
        <polygon
          points={`${cx},${shape.y} ${shape.x + shape.w},${shape.y + shape.h} ${shape.x},${shape.y + shape.h}`}
          fill={shape.fill}
          stroke={shape.stroke}
          strokeWidth={shape.strokeWidth}
          transform={transform}
          {...common}
        />
      );
    case "star": {
      const rOuter = Math.min(shape.w, shape.h) / 2;
      const rInner = rOuter * 0.45;
      return (
        <path
          d={starPath(cx, cy, rOuter, rInner, shape.starPoints ?? 5)}
          fill={shape.fill}
          stroke={shape.stroke}
          strokeWidth={shape.strokeWidth}
          transform={transform}
          {...common}
        />
      );
    }
    case "line":
      return (
        <line
          x1={shape.x}
          y1={shape.y + shape.h / 2}
          x2={shape.x + shape.w}
          y2={shape.y + shape.h / 2}
          stroke={shape.stroke}
          strokeWidth={shape.strokeWidth}
          transform={transform}
          strokeLinecap="round"
          {...common}
        />
      );
    case "arrow":
      return (
        <line
          x1={shape.x}
          y1={shape.y + shape.h / 2}
          x2={shape.x + shape.w}
          y2={shape.y + shape.h / 2}
          stroke={shape.stroke}
          strokeWidth={shape.strokeWidth}
          markerEnd="url(#arrowhead)"
          transform={transform}
          strokeLinecap="round"
          color={shape.stroke}
          {...common}
        />
      );
    case "text":
      return (
        <text
          x={cx}
          y={cy}
          fontSize={shape.fontSize ?? 24}
          fontWeight={shape.fontWeight ?? 600}
          fill={shape.textColor ?? "#1e3a5f"}
          textAnchor="middle"
          dominantBaseline="middle"
          transform={transform}
          {...common}
          style={{
            ...common.style,
            paintOrder: "stroke",
            stroke: "rgba(255,255,255,0.7)",
            strokeWidth: 2,
          }}
        >
          {shape.text}
        </text>
      );
    case "icon":
      return (
        <text
          x={cx}
          y={cy}
          fontSize={Math.min(shape.w, shape.h) * 0.85}
          textAnchor="middle"
          dominantBaseline="middle"
          transform={transform}
          {...common}
        >
          {shape.emoji}
        </text>
      );
  }
}

// ─── 선택 핸들 ───
function SelectionHandles({
  shape,
  onHandleDown,
}: {
  shape: Shape;
  onHandleDown: (e: React.MouseEvent, s: Shape, mode: DragMode) => void;
}) {
  const cx = shape.x + shape.w / 2;
  const cy = shape.y + shape.h / 2;
  const transform = `rotate(${shape.rotation} ${cx} ${cy})`;
  const handleR = 5;
  const handles: { mode: DragMode; cx: number; cy: number; cursor: string }[] = [
    { mode: "resize-tl", cx: shape.x, cy: shape.y, cursor: "nwse-resize" },
    { mode: "resize-tr", cx: shape.x + shape.w, cy: shape.y, cursor: "nesw-resize" },
    { mode: "resize-bl", cx: shape.x, cy: shape.y + shape.h, cursor: "nesw-resize" },
    { mode: "resize-br", cx: shape.x + shape.w, cy: shape.y + shape.h, cursor: "nwse-resize" },
    { mode: "resize-t", cx, cy: shape.y, cursor: "ns-resize" },
    { mode: "resize-b", cx, cy: shape.y + shape.h, cursor: "ns-resize" },
    { mode: "resize-l", cx: shape.x, cy, cursor: "ew-resize" },
    { mode: "resize-r", cx: shape.x + shape.w, cy, cursor: "ew-resize" },
  ];
  return (
    <g transform={transform}>
      <rect
        x={shape.x}
        y={shape.y}
        width={shape.w}
        height={shape.h}
        fill="none"
        stroke="var(--space-accent)"
        strokeWidth={1.5}
        strokeDasharray="4 3"
        pointerEvents="none"
      />
      {/* 회전 핸들 */}
      <line
        x1={cx}
        y1={shape.y}
        x2={cx}
        y2={shape.y - 24}
        stroke="var(--space-accent)"
        strokeWidth={1.5}
        pointerEvents="none"
      />
      <circle
        cx={cx}
        cy={shape.y - 24}
        r={6}
        fill="white"
        stroke="var(--space-accent)"
        strokeWidth={1.5}
        style={{ cursor: "grab" }}
        onMouseDown={(e) => onHandleDown(e, shape, "rotate")}
      />
      {/* 리사이즈 핸들 */}
      {handles.map((h) => (
        <rect
          key={h.mode}
          x={h.cx - handleR}
          y={h.cy - handleR}
          width={handleR * 2}
          height={handleR * 2}
          fill="white"
          stroke="var(--space-accent)"
          strokeWidth={1.5}
          style={{ cursor: h.cursor }}
          onMouseDown={(e) => onHandleDown(e, shape, h.mode)}
        />
      ))}
    </g>
  );
}

// ─── 그리는 중 미리보기 ───
function DrawingPreview({
  x,
  y,
  w,
  h,
  kind,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  kind: ShapeKind;
}) {
  const common = {
    fill: "rgba(74,168,216,0.18)",
    stroke: "var(--space-accent)",
    strokeWidth: 1,
    strokeDasharray: "4 3",
    pointerEvents: "none" as const,
  };
  if (kind === "rect" || kind === "text" || kind === "icon")
    return <rect x={x} y={y} width={w} height={h} {...common} />;
  if (kind === "ellipse")
    return <ellipse cx={x + w / 2} cy={y + h / 2} rx={w / 2} ry={h / 2} {...common} />;
  if (kind === "triangle")
    return (
      <polygon
        points={`${x + w / 2},${y} ${x + w},${y + h} ${x},${y + h}`}
        {...common}
      />
    );
  if (kind === "star")
    return (
      <path
        d={starPath(x + w / 2, y + h / 2, Math.min(w, h) / 2, Math.min(w, h) / 2 * 0.45, 5)}
        {...common}
      />
    );
  if (kind === "line" || kind === "arrow")
    return (
      <line
        x1={x}
        y1={y + h / 2}
        x2={x + w}
        y2={y + h / 2}
        stroke="var(--space-accent)"
        strokeWidth={2}
        strokeDasharray="4 3"
        pointerEvents="none"
      />
    );
  return null;
}

// ─── 우측 속성 패널 ───
function PropertyPanel({
  shape,
  onUpdate,
  onDelete,
  onDuplicate,
  onReorder,
}: {
  shape: Shape;
  onUpdate: (patch: Partial<Shape>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onReorder: (d: "front" | "back" | "forward" | "backward") => void;
}) {
  const isLineLike = shape.kind === "line" || shape.kind === "arrow";
  const isText = shape.kind === "text";
  const isIcon = shape.kind === "icon";

  return (
    <div className="space-y-3">
      <p
        className="text-xs font-medium"
        style={{ color: "var(--space-fg-muted)" }}
      >
        {kindLabel(shape.kind)} 속성
      </p>

      {isText && (
        <>
          <label className="block text-xs" style={{ color: "var(--space-fg-muted)" }}>
            내용
          </label>
          <input
            type="text"
            value={shape.text ?? ""}
            onChange={(e) => onUpdate({ text: e.target.value })}
            className="w-full rounded border px-2 py-1 text-sm"
            style={{
              background: "var(--space-bg)",
              borderColor: "var(--space-border)",
              color: "var(--space-fg)",
            }}
          />
          <label className="block text-xs" style={{ color: "var(--space-fg-muted)" }}>
            글자 크기 ({shape.fontSize})
          </label>
          <input
            type="range"
            min={8}
            max={120}
            value={shape.fontSize ?? 24}
            onChange={(e) => onUpdate({ fontSize: parseInt(e.target.value, 10) })}
            className="w-full"
          />
          <label className="block text-xs" style={{ color: "var(--space-fg-muted)" }}>
            글자 색
          </label>
          <input
            type="color"
            value={shape.textColor ?? "#1e3a5f"}
            onChange={(e) => onUpdate({ textColor: e.target.value })}
            className="h-8 w-12 cursor-pointer"
          />
        </>
      )}

      {isIcon && (
        <>
          <label className="block text-xs" style={{ color: "var(--space-fg-muted)" }}>
            이모지
          </label>
          <div className="grid grid-cols-8 gap-1 max-h-44 overflow-auto">
            {ICON_EMOJIS.map((em) => (
              <button
                key={em}
                onClick={() => onUpdate({ emoji: em })}
                className="text-lg p-1 rounded"
                style={
                  shape.emoji === em
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
          <input
            type="text"
            value={shape.emoji ?? ""}
            onChange={(e) => onUpdate({ emoji: e.target.value })}
            maxLength={4}
            placeholder="직접 입력"
            className="w-full rounded border px-2 py-1 text-sm text-center"
            style={{
              background: "var(--space-bg)",
              borderColor: "var(--space-border)",
              color: "var(--space-fg)",
            }}
          />
        </>
      )}

      {!isText && !isIcon && (
        <>
          <label className="block text-xs" style={{ color: "var(--space-fg-muted)" }}>
            채움 색
          </label>
          <div className="flex gap-1 flex-wrap">
            {PRESET_FILLS.map((c) => (
              <button
                key={c}
                onClick={() => onUpdate({ fill: c })}
                className="h-6 w-6 rounded border"
                style={{
                  background: c,
                  borderColor:
                    shape.fill === c ? "var(--space-accent)" : "var(--space-border)",
                  outline:
                    shape.fill === c ? "2px solid var(--space-accent)" : "none",
                }}
              />
            ))}
            <input
              type="color"
              value={shape.fill === "transparent" ? "#000000" : shape.fill}
              onChange={(e) => onUpdate({ fill: e.target.value })}
              className="h-6 w-7 cursor-pointer rounded"
            />
            <button
              onClick={() => onUpdate({ fill: "transparent" })}
              className="text-[10px] px-2 rounded border"
              style={{
                borderColor: "var(--space-border)",
                color: "var(--space-fg-muted)",
              }}
            >
              없음
            </button>
          </div>
          {shape.kind === "rect" && (
            <>
              <label className="block text-xs" style={{ color: "var(--space-fg-muted)" }}>
                모서리 둥글기 ({shape.rx ?? 0})
              </label>
              <input
                type="range"
                min={0}
                max={Math.min(shape.w, shape.h) / 2}
                value={shape.rx ?? 0}
                onChange={(e) => onUpdate({ rx: parseInt(e.target.value, 10) })}
                className="w-full"
              />
            </>
          )}
          {shape.kind === "star" && (
            <>
              <label className="block text-xs" style={{ color: "var(--space-fg-muted)" }}>
                꼭짓점 수 ({shape.starPoints ?? 5})
              </label>
              <input
                type="range"
                min={3}
                max={12}
                value={shape.starPoints ?? 5}
                onChange={(e) =>
                  onUpdate({ starPoints: parseInt(e.target.value, 10) })
                }
                className="w-full"
              />
            </>
          )}
        </>
      )}

      {!isText && !isIcon && (
        <>
          <label className="block text-xs" style={{ color: "var(--space-fg-muted)" }}>
            테두리 색
          </label>
          <div className="flex gap-1 flex-wrap">
            {PRESET_STROKES.map((c) => (
              <button
                key={c}
                onClick={() => onUpdate({ stroke: c })}
                className="h-6 w-6 rounded border"
                style={{
                  background:
                    c === "transparent"
                      ? "repeating-linear-gradient(45deg, #f0f0f0 0 4px, white 4px 8px)"
                      : c,
                  borderColor:
                    shape.stroke === c
                      ? "var(--space-accent)"
                      : "var(--space-border)",
                  outline:
                    shape.stroke === c ? "2px solid var(--space-accent)" : "none",
                }}
              />
            ))}
            <input
              type="color"
              value={shape.stroke === "transparent" ? "#000000" : shape.stroke}
              onChange={(e) => onUpdate({ stroke: e.target.value })}
              className="h-6 w-7 cursor-pointer rounded"
            />
          </div>
          <label className="block text-xs" style={{ color: "var(--space-fg-muted)" }}>
            테두리 굵기 ({shape.strokeWidth})
          </label>
          <input
            type="range"
            min={0}
            max={isLineLike ? 30 : 12}
            value={shape.strokeWidth}
            onChange={(e) => onUpdate({ strokeWidth: parseInt(e.target.value, 10) })}
            className="w-full"
          />
        </>
      )}

      <label className="block text-xs" style={{ color: "var(--space-fg-muted)" }}>
        투명도 ({Math.round(shape.opacity * 100)}%)
      </label>
      <input
        type="range"
        min={0.1}
        max={1}
        step={0.05}
        value={shape.opacity}
        onChange={(e) => onUpdate({ opacity: parseFloat(e.target.value) })}
        className="w-full"
      />

      <label className="block text-xs" style={{ color: "var(--space-fg-muted)" }}>
        회전 ({Math.round(shape.rotation)}°)
      </label>
      <input
        type="range"
        min={-180}
        max={180}
        value={shape.rotation}
        onChange={(e) => onUpdate({ rotation: parseInt(e.target.value, 10) })}
        className="w-full"
      />

      <div className="grid grid-cols-2 gap-1 text-[10px]">
        <button
          onClick={() => onReorder("front")}
          className="rounded border px-2 py-1"
          style={{
            borderColor: "var(--space-border)",
            color: "var(--space-fg-muted)",
          }}
        >
          맨 앞
        </button>
        <button
          onClick={() => onReorder("forward")}
          className="rounded border px-2 py-1"
          style={{
            borderColor: "var(--space-border)",
            color: "var(--space-fg-muted)",
          }}
        >
          앞으로
        </button>
        <button
          onClick={() => onReorder("backward")}
          className="rounded border px-2 py-1"
          style={{
            borderColor: "var(--space-border)",
            color: "var(--space-fg-muted)",
          }}
        >
          뒤로
        </button>
        <button
          onClick={() => onReorder("back")}
          className="rounded border px-2 py-1"
          style={{
            borderColor: "var(--space-border)",
            color: "var(--space-fg-muted)",
          }}
        >
          맨 뒤
        </button>
      </div>

      <div className="grid grid-cols-4 gap-1 text-xs pt-1 border-t" style={{ borderColor: "var(--space-border)" }}>
        <button onClick={() => onUpdate({ x: shape.x - 1 })}>←</button>
        <button onClick={() => onUpdate({ x: shape.x + 1 })}>→</button>
        <button onClick={() => onUpdate({ y: shape.y - 1 })}>↑</button>
        <button onClick={() => onUpdate({ y: shape.y + 1 })}>↓</button>
      </div>

      <div className="flex gap-2 pt-2">
        <button
          onClick={onDuplicate}
          className="flex-1 rounded border px-2 py-1 text-xs"
          style={{
            borderColor: "var(--space-border)",
            color: "var(--space-fg-muted)",
          }}
          title="Ctrl+D"
        >
          복제
        </button>
        <button
          onClick={onDelete}
          className="flex-1 rounded px-2 py-1 text-xs"
          style={{ background: "rgba(229,91,91,0.15)", color: "#e55b5b" }}
          title="Delete"
        >
          삭제
        </button>
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
      className="rounded px-2.5 py-1 text-xs"
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

function kindLabel(k: ShapeKind): string {
  return (
    {
      rect: "▭ 사각형",
      ellipse: "◯ 원",
      triangle: "▲ 삼각형",
      star: "⭐ 별",
      line: "─ 선",
      arrow: "➡ 화살표",
      text: "📝 텍스트",
      icon: "🎨 아이콘",
    } as Record<ShapeKind, string>
  )[k];
}

function toolLabel(t: Tool): string {
  if (t === "select") return "선택";
  return kindLabel(t as ShapeKind);
}
