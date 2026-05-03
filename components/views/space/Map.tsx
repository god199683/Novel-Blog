"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useSpace } from "@/components/space/SpaceContext";

// ─────────────────────────────────────────────────────────────
//  도트(타일) 맵 에디터 — 도형 구역 + 페인트 + 텍스트 라벨 + 크기 조절
// ─────────────────────────────────────────────────────────────

const SIZE_OPTIONS = [16, 24, 32, 48, 64, 96];
const DEFAULT_SIZE = 32;

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

type Tool = "paint" | "rect" | "circle" | "fill" | "eraser" | "text" | "select";

type Pt = { x: number; y: number };

type TextLabel = {
  id: string;
  x: number; // tile coordinate (float ok)
  y: number;
  text: string;
  size: number; // 1.0 = base, 2.0 = bigger
  color: string;
};

const TEXT_COLORS = [
  "#1e3a5f", "#ffffff", "#e55b5b", "#e8a63a", "#4caf84", "#5b9bd5", "#8b7ec8",
];

const newId = () =>
  `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

function resizeTiles(prev: number[], oldSize: number, newSize: number): number[] {
  const next = new Array(newSize * newSize).fill(0);
  const min = Math.min(oldSize, newSize);
  for (let y = 0; y < min; y++) {
    for (let x = 0; x < min; x++) {
      next[y * newSize + x] = prev[y * oldSize + x] ?? 0;
    }
  }
  return next;
}

export default function SpaceMapView() {
  const { space, isOwner } = useSpace();
  const [size, setSize] = useState<number>(DEFAULT_SIZE);
  const [tiles, setTiles] = useState<number[]>(() =>
    new Array(DEFAULT_SIZE * DEFAULT_SIZE).fill(0)
  );
  const [texts, setTexts] = useState<TextLabel[]>([]);
  const [loading, setLoading] = useState(true);

  const [editMode, setEditMode] = useState(false);
  const [tool, setTool] = useState<Tool>("paint");
  const [terrainId, setTerrainId] = useState(1);
  const [showGrid, setShowGrid] = useState(true);
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);

  // 되돌리기 / 다시 실행 — 최근 상태 스냅샷
  type Snap = { size: number; tiles: number[]; texts: TextLabel[] };
  const [past, setPast] = useState<Snap[]>([]);
  const [future, setFuture] = useState<Snap[]>([]);
  const HISTORY_MAX = 50;

  const isStrokingRef = useRef(false);
  const lastTileRef = useRef<Pt | null>(null);
  const [dragStart, setDragStart] = useState<Pt | null>(null);
  const [dragEnd, setDragEnd] = useState<Pt | null>(null);
  const draggingTextRef = useRef<string | null>(null);

  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const sb = supabase();
      const [tRes, txRes] = await Promise.all([
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
          .eq("key", "map_texts")
          .maybeSingle(),
      ]);
      if (!active) return;
      if (tRes.data?.value) {
        try {
          const parsed = JSON.parse(tRes.data.value);
          // 옛 포맷(배열만) 호환
          if (Array.isArray(parsed)) {
            const sq = Math.round(Math.sqrt(parsed.length));
            const validSize = SIZE_OPTIONS.includes(sq) ? sq : DEFAULT_SIZE;
            setSize(validSize);
            setTiles(parsed);
          } else if (
            parsed &&
            typeof parsed === "object" &&
            Array.isArray(parsed.tiles)
          ) {
            const sz =
              typeof parsed.size === "number" ? parsed.size : DEFAULT_SIZE;
            setSize(sz);
            setTiles(parsed.tiles);
          }
        } catch {}
      }
      if (txRes.data?.value) {
        try {
          const parsed = JSON.parse(txRes.data.value);
          if (Array.isArray(parsed)) {
            setTexts(
              parsed.map((t) => ({
                id: t.id ?? newId(),
                x: t.x ?? 0,
                y: t.y ?? 0,
                text: t.text ?? "",
                size: typeof t.size === "number" ? t.size : 1,
                color: t.color ?? "#1e3a5f",
              }))
            );
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
    async (sz: number, next: number[]) => {
      const sb = supabase();
      const value = JSON.stringify({ size: sz, tiles: next });
      const { data: existing } = await sb
        .from("garden_settings")
        .select("id")
        .eq("space_id", space.id)
        .eq("key", "tilemap")
        .maybeSingle();
      if (existing) {
        await sb.from("garden_settings").update({ value }).eq("id", existing.id);
      } else {
        await sb.from("garden_settings").insert({
          space_id: space.id,
          key: "tilemap",
          value,
          description: "도트 맵 타일",
        });
      }
    },
    [space.id]
  );

  const persistTexts = useCallback(
    async (next: TextLabel[]) => {
      const sb = supabase();
      const value = JSON.stringify(next);
      const { data: existing } = await sb
        .from("garden_settings")
        .select("id")
        .eq("space_id", space.id)
        .eq("key", "map_texts")
        .maybeSingle();
      if (existing) {
        await sb.from("garden_settings").update({ value }).eq("id", existing.id);
      } else {
        await sb.from("garden_settings").insert({
          space_id: space.id,
          key: "map_texts",
          value,
          description: "맵 텍스트 라벨",
        });
      }
    },
    [space.id]
  );

  // ─── 히스토리 ───
  const pushHistory = () => {
    const cur: Snap = { size, tiles: tiles.slice(), texts: texts.slice() };
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
    const current: Snap = {
      size,
      tiles: tiles.slice(),
      texts: texts.slice(),
    };
    setPast(past.slice(0, -1));
    setFuture((f) => [...f, current]);
    setSize(target.size);
    setTiles(target.tiles);
    setTexts(target.texts);
    setSelectedTextId(null);
    persistTiles(target.size, target.tiles);
    persistTexts(target.texts);
  };

  const redo = () => {
    if (future.length === 0) return;
    const target = future[future.length - 1];
    const current: Snap = {
      size,
      tiles: tiles.slice(),
      texts: texts.slice(),
    };
    setFuture(future.slice(0, -1));
    setPast((p) => [...p, current]);
    setSize(target.size);
    setTiles(target.tiles);
    setTexts(target.texts);
    setSelectedTextId(null);
    persistTiles(target.size, target.tiles);
    persistTexts(target.texts);
  };

  // 키보드: Ctrl/Cmd+Z 되돌리기, Ctrl/Cmd+Y 또는 Ctrl/Cmd+Shift+Z 다시
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA")
      )
        return;
      const meta = e.ctrlKey || e.metaKey;
      if (!meta) return;
      const key = e.key.toLowerCase();
      if (key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((key === "z" && e.shiftKey) || key === "y") {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [past, future, tiles, texts, size]);

  // ─── 좌표 변환 ───
  const ptAtEvent = (e: React.MouseEvent): Pt | null => {
    if (!canvasRef.current) return null;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * size;
    const y = ((e.clientY - rect.top) / rect.height) * size;
    if (x < 0 || x >= size || y < 0 || y >= size) return null;
    return { x, y };
  };
  const tileAtEvent = (e: React.MouseEvent): Pt | null => {
    const p = ptAtEvent(e);
    if (!p) return null;
    return { x: Math.floor(p.x), y: Math.floor(p.y) };
  };

  // ─── 페인트 작업 ───
  const paintAt = (x: number, y: number, id: number) => {
    setTiles((prev) => {
      const idx = y * size + x;
      if (prev[idx] === id) return prev;
      const next = prev.slice();
      next[idx] = id;
      return next;
    });
  };

  const fillRect = (a: Pt, b: Pt, id: number) => {
    pushHistory();
    const x1 = Math.max(0, Math.min(a.x, b.x));
    const y1 = Math.max(0, Math.min(a.y, b.y));
    const x2 = Math.min(size - 1, Math.max(a.x, b.x));
    const y2 = Math.min(size - 1, Math.max(a.y, b.y));
    setTiles((prev) => {
      const next = prev.slice();
      for (let yy = y1; yy <= y2; yy++) {
        for (let xx = x1; xx <= x2; xx++) {
          next[yy * size + xx] = id;
        }
      }
      persistTiles(size, next);
      return next;
    });
  };

  const fillEllipse = (a: Pt, b: Pt, id: number) => {
    pushHistory();
    const cx = (a.x + b.x) / 2 + 0.5;
    const cy = (a.y + b.y) / 2 + 0.5;
    const rx = Math.max(0.5, Math.abs(b.x - a.x) / 2 + 0.5);
    const ry = Math.max(0.5, Math.abs(b.y - a.y) / 2 + 0.5);
    setTiles((prev) => {
      const next = prev.slice();
      for (let yy = 0; yy < size; yy++) {
        for (let xx = 0; xx < size; xx++) {
          const dx = (xx + 0.5 - cx) / rx;
          const dy = (yy + 0.5 - cy) / ry;
          if (dx * dx + dy * dy <= 1) next[yy * size + xx] = id;
        }
      }
      persistTiles(size, next);
      return next;
    });
  };

  const fillFromTile = (x: number, y: number, replaceWith: number) => {
    pushHistory();
    setTiles((prev) => {
      const target = prev[y * size + x];
      if (target === replaceWith) return prev;
      const next = prev.slice();
      const stack: [number, number][] = [[x, y]];
      while (stack.length) {
        const [cx, cy] = stack.pop()!;
        if (cx < 0 || cx >= size || cy < 0 || cy >= size) continue;
        const i = cy * size + cx;
        if (next[i] !== target) continue;
        next[i] = replaceWith;
        stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
      }
      persistTiles(size, next);
      return next;
    });
  };

  // ─── 마우스 핸들러 ───
  const onCanvasMouseDown = (e: React.MouseEvent) => {
    if (!editMode || !isOwner) return;
    const p = ptAtEvent(e);
    if (!p) return;

    if (tool === "select") {
      // 가장 가까운 텍스트 라벨 잡기
      const hit = nearestText(p, texts, 1.5);
      if (hit) {
        setSelectedTextId(hit.id);
        draggingTextRef.current = hit.id;
        pushHistory(); // 드래그로 위치 바뀔 때를 대비해 미리 스냅샷
      } else {
        setSelectedTextId(null);
      }
      return;
    }

    if (tool === "text") {
      const t = window.prompt("표시할 텍스트", "");
      if (!t || !t.trim()) return;
      pushHistory();
      const label: TextLabel = {
        id: newId(),
        x: p.x,
        y: p.y,
        text: t.trim(),
        size: 1.4,
        color: "#1e3a5f",
      };
      const next = [...texts, label];
      setTexts(next);
      persistTexts(next);
      setSelectedTextId(label.id);
      setTool("select");
      return;
    }

    const tile: Pt = { x: Math.floor(p.x), y: Math.floor(p.y) };
    if (tool === "paint" || tool === "eraser") {
      pushHistory();
      paintAt(tile.x, tile.y, tool === "paint" ? terrainId : 0);
      isStrokingRef.current = true;
      lastTileRef.current = tile;
    } else if (tool === "fill") {
      fillFromTile(tile.x, tile.y, terrainId);
    } else if (tool === "rect" || tool === "circle") {
      setDragStart(tile);
      setDragEnd(tile);
    }
  };

  const onCanvasMouseMove = (e: React.MouseEvent) => {
    if (!editMode || !isOwner) return;
    const p = ptAtEvent(e);
    if (!p) return;

    if (draggingTextRef.current) {
      const id = draggingTextRef.current;
      setTexts((prev) =>
        prev.map((t) => (t.id === id ? { ...t, x: p.x, y: p.y } : t))
      );
      return;
    }

    const tile: Pt = { x: Math.floor(p.x), y: Math.floor(p.y) };
    if (isStrokingRef.current && (tool === "paint" || tool === "eraser")) {
      const last = lastTileRef.current;
      if (last && last.x === tile.x && last.y === tile.y) return;
      paintAt(tile.x, tile.y, tool === "paint" ? terrainId : 0);
      lastTileRef.current = tile;
    } else if (dragStart && (tool === "rect" || tool === "circle")) {
      setDragEnd(tile);
    }
  };

  const onCanvasMouseUp = () => {
    if (draggingTextRef.current) {
      draggingTextRef.current = null;
      persistTexts(texts);
      return;
    }
    if (isStrokingRef.current) {
      isStrokingRef.current = false;
      lastTileRef.current = null;
      persistTiles(size, tiles);
    }
    if (dragStart && dragEnd && (tool === "rect" || tool === "circle")) {
      if (tool === "rect") fillRect(dragStart, dragEnd, terrainId);
      else fillEllipse(dragStart, dragEnd, terrainId);
      setDragStart(null);
      setDragEnd(null);
    }
  };

  // ─── 텍스트 라벨 편집 ───
  const updateSelectedText = (patch: Partial<TextLabel>) => {
    if (!selectedTextId) return;
    pushHistory();
    const next = texts.map((t) =>
      t.id === selectedTextId ? { ...t, ...patch } : t
    );
    setTexts(next);
    persistTexts(next);
  };
  const removeSelectedText = () => {
    if (!selectedTextId) return;
    pushHistory();
    const next = texts.filter((t) => t.id !== selectedTextId);
    setTexts(next);
    persistTexts(next);
    setSelectedTextId(null);
  };

  // ─── 캔버스 작업 ───
  const fillCanvas = async () => {
    pushHistory();
    const filled = new Array(size * size).fill(terrainId);
    setTiles(filled);
    await persistTiles(size, filled);
  };
  const clearMap = async () => {
    if (!confirm("맵을 모두 지울까요? 텍스트 라벨도 함께 사라집니다."))
      return;
    pushHistory();
    const empty = new Array(size * size).fill(0);
    setTiles(empty);
    setTexts([]);
    setSelectedTextId(null);
    await Promise.all([persistTiles(size, empty), persistTexts([])]);
  };

  // ─── 맵 크기 변경 ───
  const changeSize = async (newSize: number) => {
    if (newSize === size) return;
    const isShrinking = newSize < size;
    if (
      isShrinking &&
      !confirm(
        `맵을 ${newSize}×${newSize}로 줄이면 오른쪽·아래 영역의 타일이 잘립니다. 계속할까요?`
      )
    ) {
      return;
    }
    pushHistory();
    const next = resizeTiles(tiles, size, newSize);
    setSize(newSize);
    setTiles(next);
    // 좌표가 새 영역을 벗어난 텍스트는 안쪽으로 끌어당김
    const newTexts = texts.map((t) => ({
      ...t,
      x: Math.min(newSize - 0.5, t.x),
      y: Math.min(newSize - 0.5, t.y),
    }));
    setTexts(newTexts);
    await Promise.all([persistTiles(newSize, next), persistTexts(newTexts)]);
  };

  const selectedText = useMemo(
    () => texts.find((t) => t.id === selectedTextId) ?? null,
    [texts, selectedTextId]
  );

  if (loading)
    return (
      <div className="flex items-center justify-center h-96">
        <p style={{ color: "var(--space-fg-muted)" }}>로딩 중...</p>
      </div>
    );

  let previewBox: { x: number; y: number; w: number; h: number } | null = null;
  if (dragStart && dragEnd && (tool === "rect" || tool === "circle")) {
    const x1 = Math.min(dragStart.x, dragEnd.x);
    const y1 = Math.min(dragStart.y, dragEnd.y);
    const x2 = Math.max(dragStart.x, dragEnd.x);
    const y2 = Math.max(dragStart.y, dragEnd.y);
    previewBox = { x: x1, y: y1, w: x2 - x1 + 1, h: y2 - y1 + 1 };
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold">🌍 정원 맵</h1>
          <p
            className="text-sm mt-1"
            style={{ color: "var(--space-fg-muted)" }}
          >
            {size}×{size} 도트 맵 — 도형 구역 · 페인트 · 텍스트 라벨
          </p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          {isOwner && editMode && (
            <div
              className="flex items-center gap-1 rounded-lg border px-2 py-1 text-xs"
              style={{
                borderColor: "var(--space-border)",
                background: "var(--space-card)",
                color: "var(--space-fg-muted)",
              }}
              title="맵 크기"
            >
              <span>맵 크기:</span>
              <select
                value={size}
                onChange={(e) => changeSize(parseInt(e.target.value, 10))}
                className="bg-transparent text-xs"
                style={{ color: "var(--space-fg)" }}
              >
                {SIZE_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}×{s}
                  </option>
                ))}
              </select>
            </div>
          )}
          {isOwner && (
            <>
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
            </>
          )}
        </div>
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
          <ToolBtn active={tool === "rect"} onClick={() => setTool("rect")}>
            ▭ 사각형 구역
          </ToolBtn>
          <ToolBtn active={tool === "circle"} onClick={() => setTool("circle")}>
            ◯ 원형 구역
          </ToolBtn>
          <ToolBtn active={tool === "fill"} onClick={() => setTool("fill")}>
            🪣 채우기
          </ToolBtn>
          <ToolBtn active={tool === "eraser"} onClick={() => setTool("eraser")}>
            🧹 지우개
          </ToolBtn>
          <span
            className="mx-1 h-5 w-px"
            style={{ background: "var(--space-border)" }}
          />
          <ToolBtn active={tool === "text"} onClick={() => setTool("text")}>
            📝 텍스트
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
          <span
            className="mx-1 h-5 w-px"
            style={{ background: "var(--space-border)" }}
          />
          <button
            type="button"
            onClick={undo}
            disabled={past.length === 0}
            className="rounded px-2 py-1 text-xs disabled:opacity-30"
            style={{ color: "var(--space-fg-muted)" }}
            title="되돌리기 (Ctrl+Z)"
          >
            ↶ 되돌리기
          </button>
          <button
            type="button"
            onClick={redo}
            disabled={future.length === 0}
            className="rounded px-2 py-1 text-xs disabled:opacity-30"
            style={{ color: "var(--space-fg-muted)" }}
            title="다시 실행 (Ctrl+Shift+Z / Ctrl+Y)"
          >
            ↷ 다시
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
            maxHeight: "calc(100vh - 240px)",
            background:
              "radial-gradient(ellipse at center, rgba(74,168,216,0.06) 0%, var(--space-card) 70%)",
            borderColor: "var(--space-border)",
            cursor:
              !editMode || !isOwner
                ? "default"
                : tool === "fill" || tool === "text"
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
            viewBox={`0 0 ${size} ${size}`}
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
              const x = i % size;
              const y = Math.floor(i / size);
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
              <g stroke="rgba(0,0,0,0.06)" strokeWidth={Math.max(0.01, 0.6 / size)}>
                {Array.from({ length: size + 1 }, (_, i) => (
                  <line key={`v${i}`} x1={i} y1={0} x2={i} y2={size} />
                ))}
                {Array.from({ length: size + 1 }, (_, i) => (
                  <line key={`h${i}`} x1={0} y1={i} x2={size} y2={i} />
                ))}
              </g>
            )}
            {previewBox && tool === "rect" && (
              <rect
                x={previewBox.x}
                y={previewBox.y}
                width={previewBox.w}
                height={previewBox.h}
                fill={TERRAIN[terrainId]?.color ?? "#888"}
                fillOpacity={0.45}
                stroke={TERRAIN[terrainId]?.color ?? "#888"}
                strokeWidth={Math.max(0.05, 3 / size)}
                strokeDasharray={`${0.4} ${0.2}`}
              />
            )}
            {previewBox && tool === "circle" && (
              <ellipse
                cx={previewBox.x + previewBox.w / 2}
                cy={previewBox.y + previewBox.h / 2}
                rx={previewBox.w / 2}
                ry={previewBox.h / 2}
                fill={TERRAIN[terrainId]?.color ?? "#888"}
                fillOpacity={0.45}
                stroke={TERRAIN[terrainId]?.color ?? "#888"}
                strokeWidth={Math.max(0.05, 3 / size)}
                strokeDasharray={`${0.4} ${0.2}`}
              />
            )}
            {/* 텍스트 라벨 */}
            {texts.map((t) => {
              const isSel = selectedTextId === t.id;
              const fontSize = (size / 18) * t.size; // 맵 크기에 비례
              return (
                <text
                  key={t.id}
                  x={t.x}
                  y={t.y}
                  fontSize={fontSize}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontWeight={600}
                  fill={t.color}
                  paintOrder="stroke"
                  stroke="rgba(255,255,255,0.85)"
                  strokeWidth={fontSize * 0.18}
                  style={{
                    filter: isSel
                      ? "drop-shadow(0 0 0.4px var(--space-accent))"
                      : undefined,
                    pointerEvents: "none",
                  }}
                >
                  {t.text}
                </text>
              );
            })}
          </svg>
        </div>

        <aside
          className="rounded-xl p-4 border h-fit space-y-4"
          style={{
            background: "var(--space-card)",
            borderColor: "var(--space-border)",
          }}
        >
          {/* 텍스트 선택됐을 때 — 편집 패널 */}
          {tool === "select" && selectedText ? (
            <div>
              <p
                className="text-xs font-medium mb-2"
                style={{ color: "var(--space-fg-muted)" }}
              >
                📝 선택된 텍스트
              </p>
              <label
                className="block text-xs mb-1"
                style={{ color: "var(--space-fg-muted)" }}
              >
                내용
              </label>
              <input
                type="text"
                value={selectedText.text}
                onChange={(e) => updateSelectedText({ text: e.target.value })}
                disabled={!editMode || !isOwner}
                className="w-full rounded border px-2 py-1 text-sm mb-2"
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
                크기 ({selectedText.size.toFixed(1)})
              </label>
              <input
                type="range"
                min={0.5}
                max={4}
                step={0.1}
                value={selectedText.size}
                onChange={(e) =>
                  updateSelectedText({ size: parseFloat(e.target.value) })
                }
                disabled={!editMode || !isOwner}
                className="w-full mb-2"
              />
              <p
                className="text-xs mb-1"
                style={{ color: "var(--space-fg-muted)" }}
              >
                색상
              </p>
              <div className="flex gap-2 flex-wrap mb-3">
                {TEXT_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => updateSelectedText({ color: c })}
                    disabled={!editMode || !isOwner}
                    className="h-6 w-6 rounded-full border"
                    style={{
                      background: c,
                      borderColor:
                        selectedText.color === c
                          ? "var(--space-accent)"
                          : "var(--space-border)",
                      outline:
                        selectedText.color === c
                          ? "2px solid var(--space-accent)"
                          : "none",
                    }}
                  />
                ))}
                <input
                  type="color"
                  value={selectedText.color}
                  onChange={(e) =>
                    updateSelectedText({ color: e.target.value })
                  }
                  disabled={!editMode || !isOwner}
                  className="h-6 w-8 cursor-pointer"
                />
              </div>
              <p
                className="text-xs mb-3"
                style={{ color: "var(--space-fg-soft)" }}
              >
                위치: ({selectedText.x.toFixed(1)}, {selectedText.y.toFixed(1)})
                · 캔버스에서 드래그로 이동
              </p>
              {editMode && isOwner && (
                <button
                  onClick={removeSelectedText}
                  className="w-full rounded px-2 py-1 text-xs"
                  style={{
                    background: "rgba(229,91,91,0.15)",
                    color: "#e55b5b",
                  }}
                >
                  텍스트 삭제
                </button>
              )}
            </div>
          ) : editMode && isOwner ? (
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
              <p
                className="text-xs mt-3"
                style={{ color: "var(--space-fg-soft)" }}
              >
                {tool === "paint" && "🖌️ 클릭·드래그로 한 칸씩 칠합니다"}
                {tool === "rect" &&
                  "▭ 클릭·드래그로 사각형 구역을 한 번에 채웁니다"}
                {tool === "circle" &&
                  "◯ 클릭·드래그로 원/타원 구역을 채웁니다"}
                {tool === "fill" &&
                  "🪣 같은 색으로 이어진 영역을 한 번에 칠합니다"}
                {tool === "eraser" && "🧹 클릭·드래그로 한 칸씩 지웁니다"}
                {tool === "text" &&
                  "📝 캔버스를 클릭해서 그 자리에 텍스트를 붙입니다"}
                {tool === "select" &&
                  "↖ 텍스트 라벨을 클릭해 선택, 드래그로 이동"}
              </p>
            </div>
          ) : (
            <div
              className="text-sm text-center py-6"
              style={{ color: "var(--space-fg-soft)" }}
            >
              <p className="mb-2">
                {tiles.filter((t) => t !== 0).length}칸 그려짐 · 텍스트{" "}
                {texts.length}개
              </p>
              {!editMode && isOwner && (
                <p className="text-xs">편집 모드를 켜면 그릴 수 있어요.</p>
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function nearestText(p: Pt, list: TextLabel[], maxDist: number) {
  let best: { id: string; d: number } | null = null;
  for (const t of list) {
    const d = Math.hypot(t.x - p.x, t.y - p.y);
    if (d < maxDist && (!best || d < best.d)) best = { id: t.id, d };
  }
  return best;
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
