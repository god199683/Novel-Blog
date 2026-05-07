"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useSpace } from "@/components/space/SpaceContext";

// =============================================================
//  게임형 도트 맵 에디터
//   - 레이어: 지형 / 객체 / 텍스트
//   - 도구: 페인트(브러시 1·3·5) / 사각형·원 구역 / 채우기 / 지우개
//           영역이동(연결된 동색 타일) / 영역선택(직사각형) /
//           객체 / 텍스트 / 선택
//   - 줌·팬, 격자, 되돌리기/다시
// =============================================================

const SIZE_OPTIONS = [16, 24, 32, 48, 64, 96];
const DEFAULT_SIZE = 32;
const HISTORY_MAX = 60;

type TileType = { id: number; name: string; color: string };
const TILES: TileType[] = [
  { id: 0, name: "비움", color: "transparent" },
  { id: 1, name: "잔디", color: "#7cba3d" },
  { id: 2, name: "짙은풀", color: "#3e8a3e" },
  { id: 3, name: "흙", color: "#8b6f47" },
  { id: 4, name: "돌", color: "#9aa0a6" },
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
  { id: 16, name: "지붕", color: "#a64242" },
  { id: 17, name: "흙길", color: "#a17c4a" },
  { id: 18, name: "돌길", color: "#7a7d80" },
];
const CATEGORIES: { name: string; ids: number[] }[] = [
  { name: "자연", ids: [1, 2, 8, 13, 14] },
  { name: "물", ids: [5, 6, 7] },
  { name: "흙·돌", ids: [3, 4, 17, 18] },
  { name: "건물", ids: [11, 12, 16] },
  { name: "환경", ids: [9, 10, 15] },
];

const OBJECT_EMOJIS = [
  "🌳", "🌲", "🌴", "🌵", "🌸", "🌺", "🌻", "🍄",
  "🌿", "🪴", "🪨", "⛲", "🗿", "🏛️", "🏠", "🏰",
  "⛩️", "🕯️", "🚪", "🛏️", "🪑", "💎", "🗝️", "📜",
  "🐦", "🦌", "🦊", "🐰", "🦋", "🐝", "👤", "🧙",
  "⚔️", "🛡️", "🏹", "🔥", "❄️", "💧", "✨", "⭐",
];
const TEXT_COLORS = [
  "#1e3a5f", "#ffffff", "#e55b5b", "#e8a63a", "#4caf84", "#5b9bd5", "#8b7ec8",
];

type Tool =
  | "paint"
  | "rect"
  | "circle"
  | "fill"
  | "eraser"
  | "moveRegion"
  | "object"
  | "text"
  | "select";

type Pt = { x: number; y: number };
type ObjMarker = { id: string; x: number; y: number; emoji: string; name?: string };
type TextLabel = {
  id: string;
  x: number;
  y: number;
  text: string;
  size: number;
  color: string;
};
type Snap = {
  size: number;
  terrain: number[];
  objects: ObjMarker[];
  texts: TextLabel[];
};

const newId = () =>
  `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

function resizeTiles(prev: number[], oldSize: number, newSize: number): number[] {
  const next = new Array(newSize * newSize).fill(0);
  const min = Math.min(oldSize, newSize);
  for (let y = 0; y < min; y++)
    for (let x = 0; x < min; x++)
      next[y * newSize + x] = prev[y * oldSize + x] ?? 0;
  return next;
}

export default function SpaceMapView() {
  const { space, isOwner } = useSpace();

  // ─── 데이터 상태 ───
  const [size, setSize] = useState(DEFAULT_SIZE);
  const [terrain, setTerrain] = useState<number[]>(() =>
    new Array(DEFAULT_SIZE * DEFAULT_SIZE).fill(0)
  );
  const [objects, setObjects] = useState<ObjMarker[]>([]);
  const [texts, setTexts] = useState<TextLabel[]>([]);
  const [loading, setLoading] = useState(true);

  // ─── UI 상태 ───
  const [editMode, setEditMode] = useState(false);
  const [tool, setTool] = useState<Tool>("paint");
  const [terrainId, setTerrainId] = useState(1);
  const [brushSize, setBrushSize] = useState<1 | 3 | 5>(1);
  const [pendingEmoji, setPendingEmoji] = useState("🌳");
  const [showGrid, setShowGrid] = useState(true);
  const [layers, setLayers] = useState({
    terrain: true,
    objects: true,
    texts: true,
  });
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);

  // 드래그 상태
  const isStrokingRef = useRef(false);
  const lastTileRef = useRef<Pt | null>(null);
  const [dragShape, setDragShape] = useState<{ a: Pt; b: Pt } | null>(null);
  const draggingObjectRef = useRef<string | null>(null);
  const draggingTextRef = useRef<string | null>(null);
  const [dragRegion, setDragRegion] = useState<{
    tiles: Pt[];
    color: number;
    origin: Pt;
    current: Pt;
  } | null>(null);

  // 줌·팬
  const [vb, setVb] = useState<{ x: number; y: number; w: number; h: number }>({
    x: 0,
    y: 0,
    w: 0,
    h: 0,
  });
  const isPanningRef = useRef<{ mx: number; my: number; vx: number; vy: number } | null>(null);

  // 히스토리
  const [past, setPast] = useState<Snap[]>([]);
  const [future, setFuture] = useState<Snap[]>([]);

  const canvasRef = useRef<HTMLDivElement>(null);

  // ─── 초기 로드 ───
  useEffect(() => {
    let active = true;
    (async () => {
      const sb = supabase();
      const [tRes, oRes, txRes] = await Promise.all([
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
          .eq("key", "map_objects")
          .maybeSingle(),
        sb
          .from("garden_settings")
          .select("*")
          .eq("space_id", space.id)
          .eq("key", "map_texts")
          .maybeSingle(),
      ]);
      if (!active) return;

      let loadedSize = DEFAULT_SIZE;
      if (tRes.data?.value) {
        try {
          const parsed = JSON.parse(tRes.data.value);
          if (Array.isArray(parsed)) {
            const sq = Math.round(Math.sqrt(parsed.length));
            loadedSize = SIZE_OPTIONS.includes(sq) ? sq : DEFAULT_SIZE;
            setSize(loadedSize);
            setTerrain(parsed);
          } else if (parsed?.tiles && Array.isArray(parsed.tiles)) {
            loadedSize =
              typeof parsed.size === "number" ? parsed.size : DEFAULT_SIZE;
            setSize(loadedSize);
            setTerrain(parsed.tiles);
          }
        } catch {}
      }

      // 객체 로드 — 옛 map_markers (% 좌표) 호환도 같은 키로
      if (oRes.data?.value) {
        try {
          const parsed = JSON.parse(oRes.data.value);
          if (Array.isArray(parsed)) {
            setObjects(
              parsed.map((m) => ({
                id: m.id ?? newId(),
                emoji: m.emoji ?? "❓",
                name: m.name ?? m.label,
                x: typeof m.x === "number" ? m.x : 0,
                y: typeof m.y === "number" ? m.y : 0,
              }))
            );
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

      setVb({ x: 0, y: 0, w: loadedSize, h: loadedSize });
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [space.id]);

  // ─── DB 저장 ───
  const upsertSetting = useCallback(
    async (key: string, value: string) => {
      const sb = supabase();
      const { data: existing } = await sb
        .from("garden_settings")
        .select("id")
        .eq("space_id", space.id)
        .eq("key", key)
        .maybeSingle();
      if (existing) {
        await sb
          .from("garden_settings")
          .update({ value })
          .eq("id", existing.id);
      } else {
        await sb.from("garden_settings").insert({
          space_id: space.id,
          key,
          value,
        });
      }
    },
    [space.id]
  );

  const persistTerrain = useCallback(
    (sz: number, t: number[]) =>
      upsertSetting("tilemap", JSON.stringify({ size: sz, tiles: t })),
    [upsertSetting]
  );
  const persistObjects = useCallback(
    (objs: ObjMarker[]) => upsertSetting("map_objects", JSON.stringify(objs)),
    [upsertSetting]
  );
  const persistTexts = useCallback(
    (ts: TextLabel[]) => upsertSetting("map_texts", JSON.stringify(ts)),
    [upsertSetting]
  );

  // ─── 히스토리 ───
  const pushHistory = () => {
    const cur: Snap = {
      size,
      terrain: terrain.slice(),
      objects: objects.slice(),
      texts: texts.slice(),
    };
    setPast((p) => {
      const next = p.length >= HISTORY_MAX ? p.slice(1) : p.slice();
      next.push(cur);
      return next;
    });
    setFuture([]);
  };

  const restoreSnap = (s: Snap) => {
    setSize(s.size);
    setTerrain(s.terrain);
    setObjects(s.objects);
    setTexts(s.texts);
    persistTerrain(s.size, s.terrain);
    persistObjects(s.objects);
    persistTexts(s.texts);
  };

  const undo = () => {
    if (past.length === 0) return;
    const target = past[past.length - 1];
    const cur: Snap = {
      size,
      terrain: terrain.slice(),
      objects: objects.slice(),
      texts: texts.slice(),
    };
    setPast(past.slice(0, -1));
    setFuture((f) => [...f, cur]);
    restoreSnap(target);
    setSelectedObjectId(null);
    setSelectedTextId(null);
  };
  const redo = () => {
    if (future.length === 0) return;
    const target = future[future.length - 1];
    const cur: Snap = {
      size,
      terrain: terrain.slice(),
      objects: objects.slice(),
      texts: texts.slice(),
    };
    setFuture(future.slice(0, -1));
    setPast((p) => [...p, cur]);
    restoreSnap(target);
    setSelectedObjectId(null);
    setSelectedTextId(null);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      const meta = e.ctrlKey || e.metaKey;
      if (meta && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (
        (meta && e.key.toLowerCase() === "y") ||
        (meta && e.shiftKey && e.key.toLowerCase() === "z")
      ) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [past, future, size, terrain, objects, texts]);

  // ─── 좌표 변환 ───
  const ptAtEvent = (e: React.MouseEvent): Pt | null => {
    if (!canvasRef.current) return null;
    const rect = canvasRef.current.getBoundingClientRect();
    const fx = (e.clientX - rect.left) / rect.width;
    const fy = (e.clientY - rect.top) / rect.height;
    const x = vb.x + fx * vb.w;
    const y = vb.y + fy * vb.h;
    if (x < 0 || x >= size || y < 0 || y >= size) return null;
    return { x, y };
  };
  const tileAtEvent = (e: React.MouseEvent): Pt | null => {
    const p = ptAtEvent(e);
    if (!p) return null;
    return { x: Math.floor(p.x), y: Math.floor(p.y) };
  };

  // ─── 페인트 ───
  const paintBrush = (cx: number, cy: number, id: number, draft?: number[]) => {
    const r = Math.floor(brushSize / 2);
    const target = draft ?? terrain.slice();
    for (let y = cy - r; y <= cy + r; y++) {
      for (let x = cx - r; x <= cx + r; x++) {
        if (x < 0 || x >= size || y < 0 || y >= size) continue;
        target[y * size + x] = id;
      }
    }
    if (!draft) setTerrain(target);
    return target;
  };

  const fillRect = (a: Pt, b: Pt, id: number) => {
    pushHistory();
    const x1 = Math.max(0, Math.min(a.x, b.x));
    const y1 = Math.max(0, Math.min(a.y, b.y));
    const x2 = Math.min(size - 1, Math.max(a.x, b.x));
    const y2 = Math.min(size - 1, Math.max(a.y, b.y));
    const next = terrain.slice();
    for (let y = y1; y <= y2; y++)
      for (let x = x1; x <= x2; x++) next[y * size + x] = id;
    setTerrain(next);
    persistTerrain(size, next);
  };

  const fillEllipse = (a: Pt, b: Pt, id: number) => {
    pushHistory();
    const cx = (a.x + b.x) / 2 + 0.5;
    const cy = (a.y + b.y) / 2 + 0.5;
    const rx = Math.max(0.5, Math.abs(b.x - a.x) / 2 + 0.5);
    const ry = Math.max(0.5, Math.abs(b.y - a.y) / 2 + 0.5);
    const next = terrain.slice();
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        const dx = (x + 0.5 - cx) / rx;
        const dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1) next[y * size + x] = id;
      }
    setTerrain(next);
    persistTerrain(size, next);
  };

  const fillFromTile = (x: number, y: number, replaceWith: number) => {
    const target = terrain[y * size + x];
    if (target === replaceWith) return;
    pushHistory();
    const next = terrain.slice();
    const stack: [number, number][] = [[x, y]];
    while (stack.length) {
      const [cx, cy] = stack.pop()!;
      if (cx < 0 || cx >= size || cy < 0 || cy >= size) continue;
      const i = cy * size + cx;
      if (next[i] !== target) continue;
      next[i] = replaceWith;
      stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
    }
    setTerrain(next);
    persistTerrain(size, next);
  };

  // 같은 색으로 이어진 영역 찾기 (4-방향)
  const findRegion = (x: number, y: number): { tiles: Pt[]; color: number } => {
    const color = terrain[y * size + x];
    if (color === 0) return { tiles: [], color: 0 };
    const tiles: Pt[] = [];
    const visited = new Set<number>();
    const stack: [number, number][] = [[x, y]];
    while (stack.length) {
      const [cx, cy] = stack.pop()!;
      if (cx < 0 || cx >= size || cy < 0 || cy >= size) continue;
      const i = cy * size + cx;
      if (visited.has(i)) continue;
      if (terrain[i] !== color) continue;
      visited.add(i);
      tiles.push({ x: cx, y: cy });
      stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
    }
    return { tiles, color };
  };

  // ─── 마우스 핸들러 ───
  const onCanvasMouseDown = (e: React.MouseEvent) => {
    // 가운데 버튼 → 패닝
    if (e.button === 1) {
      e.preventDefault();
      isPanningRef.current = {
        mx: e.clientX,
        my: e.clientY,
        vx: vb.x,
        vy: vb.y,
      };
      return;
    }
    if (!editMode || !isOwner) return;
    const p = ptAtEvent(e);
    if (!p) return;
    const tile: Pt = { x: Math.floor(p.x), y: Math.floor(p.y) };

    // 객체 또는 텍스트 클릭 — select 도구
    if (tool === "select") {
      const obj = nearestObject(p, objects, 0.7);
      if (obj && layers.objects) {
        setSelectedObjectId(obj.id);
        setSelectedTextId(null);
        draggingObjectRef.current = obj.id;
        pushHistory();
        return;
      }
      const tx = nearestText(p, texts, 1.5);
      if (tx && layers.texts) {
        setSelectedTextId(tx.id);
        setSelectedObjectId(null);
        draggingTextRef.current = tx.id;
        pushHistory();
        return;
      }
      setSelectedObjectId(null);
      setSelectedTextId(null);
      return;
    }

    if (tool === "object") {
      pushHistory();
      const existing = objects.find((m) => m.x === tile.x && m.y === tile.y);
      let next: ObjMarker[];
      if (existing) {
        next = objects.map((m) =>
          m.id === existing.id ? { ...m, emoji: pendingEmoji } : m
        );
      } else {
        next = [
          ...objects,
          { id: newId(), x: tile.x, y: tile.y, emoji: pendingEmoji },
        ];
      }
      setObjects(next);
      persistObjects(next);
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

    if (tool === "moveRegion") {
      const region = findRegion(tile.x, tile.y);
      if (region.tiles.length === 0) return;
      pushHistory();
      setDragRegion({
        tiles: region.tiles,
        color: region.color,
        origin: tile,
        current: tile,
      });
      return;
    }

    if (tool === "fill") {
      fillFromTile(tile.x, tile.y, terrainId);
      return;
    }

    if (tool === "rect" || tool === "circle") {
      setDragShape({ a: tile, b: tile });
      return;
    }

    if (tool === "paint" || tool === "eraser") {
      pushHistory();
      paintBrush(tile.x, tile.y, tool === "paint" ? terrainId : 0);
      isStrokingRef.current = true;
      lastTileRef.current = tile;
    }
  };

  const onCanvasMouseMove = (e: React.MouseEvent) => {
    // 패닝
    if (isPanningRef.current) {
      const ps = isPanningRef.current;
      const rect = canvasRef.current!.getBoundingClientRect();
      const sx = vb.w / rect.width;
      const sy = vb.h / rect.height;
      setVb((v) => ({
        ...v,
        x: ps.vx - (e.clientX - ps.mx) * sx,
        y: ps.vy - (e.clientY - ps.my) * sy,
      }));
      return;
    }
    if (!editMode || !isOwner) return;
    const p = ptAtEvent(e);
    if (!p) return;
    const tile: Pt = { x: Math.floor(p.x), y: Math.floor(p.y) };

    if (draggingObjectRef.current) {
      const id = draggingObjectRef.current;
      setObjects((prev) =>
        prev.map((m) => (m.id === id ? { ...m, x: tile.x, y: tile.y } : m))
      );
      return;
    }
    if (draggingTextRef.current) {
      const id = draggingTextRef.current;
      setTexts((prev) =>
        prev.map((t) => (t.id === id ? { ...t, x: p.x, y: p.y } : t))
      );
      return;
    }
    if (dragRegion) {
      setDragRegion({ ...dragRegion, current: tile });
      return;
    }

    if (isStrokingRef.current && (tool === "paint" || tool === "eraser")) {
      const last = lastTileRef.current;
      if (last && last.x === tile.x && last.y === tile.y) return;
      paintBrush(tile.x, tile.y, tool === "paint" ? terrainId : 0);
      lastTileRef.current = tile;
    } else if (dragShape && (tool === "rect" || tool === "circle")) {
      setDragShape({ ...dragShape, b: tile });
    }
  };

  const onCanvasMouseUp = () => {
    if (isPanningRef.current) {
      isPanningRef.current = null;
      return;
    }
    if (draggingObjectRef.current) {
      draggingObjectRef.current = null;
      persistObjects(objects);
      return;
    }
    if (draggingTextRef.current) {
      draggingTextRef.current = null;
      persistTexts(texts);
      return;
    }
    if (dragRegion) {
      const dx = dragRegion.current.x - dragRegion.origin.x;
      const dy = dragRegion.current.y - dragRegion.origin.y;
      if (dx !== 0 || dy !== 0) {
        const next = terrain.slice();
        for (const pt of dragRegion.tiles) next[pt.y * size + pt.x] = 0;
        for (const pt of dragRegion.tiles) {
          const nx = pt.x + dx;
          const ny = pt.y + dy;
          if (nx >= 0 && nx < size && ny >= 0 && ny < size) {
            next[ny * size + nx] = dragRegion.color;
          }
        }
        setTerrain(next);
        persistTerrain(size, next);
      }
      setDragRegion(null);
      return;
    }
    if (isStrokingRef.current) {
      isStrokingRef.current = false;
      lastTileRef.current = null;
      persistTerrain(size, terrain);
    }
    if (dragShape && (tool === "rect" || tool === "circle")) {
      if (tool === "rect") fillRect(dragShape.a, dragShape.b, terrainId);
      else fillEllipse(dragShape.a, dragShape.b, terrainId);
      setDragShape(null);
    }
  };

  // 휠 줌
  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const p = ptAtEvent(e);
    if (!p) return;
    const factor = e.deltaY > 0 ? 1.15 : 1 / 1.15;
    const newW = Math.max(4, Math.min(size * 2, vb.w * factor));
    const newH = Math.max(4, Math.min(size * 2, vb.h * factor));
    const ratio = newW / vb.w;
    setVb({
      x: p.x - (p.x - vb.x) * ratio,
      y: p.y - (p.y - vb.y) * ratio,
      w: newW,
      h: newH,
    });
  };

  // ─── 객체/텍스트 선택 편집 ───
  const updateSelectedObject = (patch: Partial<ObjMarker>) => {
    if (!selectedObjectId) return;
    pushHistory();
    const next = objects.map((m) =>
      m.id === selectedObjectId ? { ...m, ...patch } : m
    );
    setObjects(next);
    persistObjects(next);
  };
  const removeSelectedObject = () => {
    if (!selectedObjectId) return;
    pushHistory();
    const next = objects.filter((m) => m.id !== selectedObjectId);
    setObjects(next);
    persistObjects(next);
    setSelectedObjectId(null);
  };

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
    setTerrain(filled);
    await persistTerrain(size, filled);
  };
  const clearMap = async () => {
    if (!confirm("맵 전체를 비울까요? 객체와 텍스트도 모두 사라집니다.")) return;
    pushHistory();
    const empty = new Array(size * size).fill(0);
    setTerrain(empty);
    setObjects([]);
    setTexts([]);
    setSelectedObjectId(null);
    setSelectedTextId(null);
    await Promise.all([
      persistTerrain(size, empty),
      persistObjects([]),
      persistTexts([]),
    ]);
  };
  const changeSize = async (newSize: number) => {
    if (newSize === size) return;
    if (
      newSize < size &&
      !confirm(`${newSize}×${newSize}로 줄이면 가장자리 타일이 잘립니다. 계속할까요?`)
    )
      return;
    pushHistory();
    const next = resizeTiles(terrain, size, newSize);
    const newObjects = objects.filter((m) => m.x < newSize && m.y < newSize);
    const newTexts = texts.map((t) => ({
      ...t,
      x: Math.min(newSize - 0.5, t.x),
      y: Math.min(newSize - 0.5, t.y),
    }));
    setSize(newSize);
    setTerrain(next);
    setObjects(newObjects);
    setTexts(newTexts);
    setVb({ x: 0, y: 0, w: newSize, h: newSize });
    await Promise.all([
      persistTerrain(newSize, next),
      persistObjects(newObjects),
      persistTexts(newTexts),
    ]);
  };

  const selObj = useMemo(
    () => objects.find((m) => m.id === selectedObjectId) ?? null,
    [objects, selectedObjectId]
  );
  const selText = useMemo(
    () => texts.find((t) => t.id === selectedTextId) ?? null,
    [texts, selectedTextId]
  );

  if (loading)
    return (
      <div className="flex items-center justify-center h-96">
        <p style={{ color: "var(--space-fg-muted)" }}>로딩 중...</p>
      </div>
    );

  // 도형 미리보기
  let preview: { x: number; y: number; w: number; h: number } | null = null;
  if (dragShape && (tool === "rect" || tool === "circle")) {
    const x1 = Math.min(dragShape.a.x, dragShape.b.x);
    const y1 = Math.min(dragShape.a.y, dragShape.b.y);
    const x2 = Math.max(dragShape.a.x, dragShape.b.x);
    const y2 = Math.max(dragShape.a.y, dragShape.b.y);
    preview = { x: x1, y: y1, w: x2 - x1 + 1, h: y2 - y1 + 1 };
  }

  // 영역 이동 미리보기 위치 (offset)
  const regionDx = dragRegion
    ? dragRegion.current.x - dragRegion.origin.x
    : 0;
  const regionDy = dragRegion
    ? dragRegion.current.y - dragRegion.origin.y
    : 0;

  const cursor =
    !editMode || !isOwner
      ? "default"
      : isPanningRef.current
        ? "grabbing"
        : tool === "select"
          ? "default"
          : tool === "moveRegion"
            ? "move"
            : "crosshair";

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold">🌍 정원 맵 — 게임 에디터</h1>
          <p
            className="text-sm mt-1"
            style={{ color: "var(--space-fg-muted)" }}
          >
            {size}×{size} 도트 · 레이어 {Object.values(layers).filter(Boolean).length}/3 활성
          </p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          {isOwner && editMode && (
            <select
              value={size}
              onChange={(e) => changeSize(parseInt(e.target.value, 10))}
              className="rounded-lg border px-2 py-2 text-xs bg-transparent"
              style={{
                borderColor: "var(--space-border)",
                color: "var(--space-fg)",
              }}
            >
              {SIZE_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}×{s}
                </option>
              ))}
            </select>
          )}
          <div
            className="flex items-center gap-1 rounded-lg border px-1.5 py-1 text-xs"
            style={{
              borderColor: "var(--space-border)",
              background: "var(--space-card)",
              color: "var(--space-fg-muted)",
            }}
          >
            <button onClick={() => zoomBy(setVb, vb, 1 / 1.2)} className="px-1.5">⊕</button>
            <button onClick={() => zoomBy(setVb, vb, 1.2)} className="px-1.5">⊖</button>
            <button onClick={() => setVb({ x: 0, y: 0, w: size, h: size })} className="px-1.5">⤢</button>
          </div>
          {isOwner && (
            <>
              <button
                onClick={() => {
                  setEditMode((m) => !m);
                  setSelectedObjectId(null);
                  setSelectedTextId(null);
                }}
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

      {/* 도구 모음 */}
      {editMode && isOwner && (
        <div
          className="mb-3 flex flex-wrap items-center gap-1.5 rounded-lg border p-2 text-sm"
          style={{
            background: "var(--space-card)",
            borderColor: "var(--space-border)",
          }}
        >
          <ToolBtn active={tool === "paint"} onClick={() => setTool("paint")}>🖌️ 페인트</ToolBtn>
          <ToolBtn active={tool === "eraser"} onClick={() => setTool("eraser")}>🧹 지우개</ToolBtn>
          <ToolBtn active={tool === "rect"} onClick={() => setTool("rect")}>▭ 사각형</ToolBtn>
          <ToolBtn active={tool === "circle"} onClick={() => setTool("circle")}>◯ 원형</ToolBtn>
          <ToolBtn active={tool === "fill"} onClick={() => setTool("fill")}>🪣 채우기</ToolBtn>
          <ToolBtn active={tool === "moveRegion"} onClick={() => setTool("moveRegion")}>✋ 영역이동</ToolBtn>
          <span className="mx-1 h-5 w-px" style={{ background: "var(--space-border)" }} />
          <ToolBtn active={tool === "object"} onClick={() => setTool("object")}>🎨 객체</ToolBtn>
          <ToolBtn active={tool === "text"} onClick={() => setTool("text")}>📝 텍스트</ToolBtn>
          <ToolBtn active={tool === "select"} onClick={() => setTool("select")}>↖ 선택</ToolBtn>
          <span className="mx-1 h-5 w-px" style={{ background: "var(--space-border)" }} />
          {(tool === "paint" || tool === "eraser") && (
            <>
              <span className="text-xs" style={{ color: "var(--space-fg-soft)" }}>
                브러시
              </span>
              {[1, 3, 5].map((b) => (
                <button
                  key={b}
                  onClick={() => setBrushSize(b as 1 | 3 | 5)}
                  className="rounded px-2 py-1 text-xs"
                  style={
                    brushSize === b
                      ? { background: "var(--space-accent)", color: "white" }
                      : { color: "var(--space-fg-muted)" }
                  }
                >
                  {b}×{b}
                </button>
              ))}
              <span className="mx-1 h-5 w-px" style={{ background: "var(--space-border)" }} />
            </>
          )}
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
            onClick={undo}
            disabled={past.length === 0}
            className="rounded px-2 py-1 text-xs disabled:opacity-30"
            style={{ color: "var(--space-fg-muted)" }}
            title="되돌리기 (Ctrl+Z)"
          >
            ↶
          </button>
          <button
            onClick={redo}
            disabled={future.length === 0}
            className="rounded px-2 py-1 text-xs disabled:opacity-30"
            style={{ color: "var(--space-fg-muted)" }}
            title="다시 (Ctrl+Y)"
          >
            ↷
          </button>
        </div>
      )}

      {/* 레이어 토글 */}
      <div
        className="mb-3 flex items-center gap-2 rounded-lg border p-2 text-xs"
        style={{
          background: "var(--space-card)",
          borderColor: "var(--space-border)",
        }}
      >
        <span style={{ color: "var(--space-fg-muted)" }}>레이어:</span>
        {(["terrain", "objects", "texts"] as const).map((k) => (
          <button
            key={k}
            onClick={() => setLayers((s) => ({ ...s, [k]: !s[k] }))}
            className="rounded px-2 py-1"
            style={
              layers[k]
                ? { background: "var(--space-accent-soft)", color: "var(--space-accent)" }
                : { color: "var(--space-fg-soft)", textDecoration: "line-through" }
            }
          >
            {k === "terrain" ? "🟦 지형" : k === "objects" ? "🎨 객체" : "📝 텍스트"}
          </button>
        ))}
      </div>

      <div className="grid lg:grid-cols-[1fr_280px] gap-4">
        {/* 캔버스 */}
        <div
          ref={canvasRef}
          onMouseDown={onCanvasMouseDown}
          onMouseMove={onCanvasMouseMove}
          onMouseUp={onCanvasMouseUp}
          onMouseLeave={onCanvasMouseUp}
          onWheel={onWheel}
          onContextMenu={(e) => e.preventDefault()}
          className="relative overflow-hidden rounded-2xl border w-full"
          style={{
            aspectRatio: "1 / 1",
            maxHeight: "calc(100vh - 260px)",
            background:
              "radial-gradient(ellipse at center, rgba(74,168,216,0.06) 0%, var(--space-card) 70%)",
            borderColor: "var(--space-border)",
            cursor,
            userSelect: "none",
            imageRendering: "pixelated",
          }}
        >
          <svg
            viewBox={`${vb.x} ${vb.y} ${vb.w || size} ${vb.h || size}`}
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
            {/* 지형 */}
            {layers.terrain &&
              terrain.map((id, i) => {
                if (id === 0) return null;
                // 영역 이동 중인 타일은 투명도 낮춤 (빈 공간 표시)
                if (
                  dragRegion &&
                  dragRegion.tiles.some(
                    (t) =>
                      t.x === i % size &&
                      t.y === Math.floor(i / size)
                  )
                )
                  return null;
                const x = i % size;
                const y = Math.floor(i / size);
                return (
                  <rect
                    key={i}
                    x={x}
                    y={y}
                    width={1}
                    height={1}
                    fill={TILES[id]?.color ?? "#888"}
                  />
                );
              })}

            {/* 영역 이동 미리보기 */}
            {dragRegion && layers.terrain && (
              <g opacity={0.85}>
                {dragRegion.tiles.map((t, i) => (
                  <rect
                    key={i}
                    x={t.x + regionDx}
                    y={t.y + regionDy}
                    width={1}
                    height={1}
                    fill={TILES[dragRegion.color]?.color ?? "#888"}
                    stroke="white"
                    strokeWidth={0.05}
                  />
                ))}
              </g>
            )}

            {showGrid && (
              <g
                stroke="rgba(0,0,0,0.06)"
                strokeWidth={Math.max(0.01, 0.6 / size)}
              >
                {Array.from({ length: size + 1 }, (_, i) => (
                  <line key={`v${i}`} x1={i} y1={0} x2={i} y2={size} />
                ))}
                {Array.from({ length: size + 1 }, (_, i) => (
                  <line key={`h${i}`} x1={0} y1={i} x2={size} y2={i} />
                ))}
              </g>
            )}

            {preview && tool === "rect" && (
              <rect
                x={preview.x}
                y={preview.y}
                width={preview.w}
                height={preview.h}
                fill={TILES[terrainId]?.color ?? "#888"}
                fillOpacity={0.4}
                stroke={TILES[terrainId]?.color ?? "#888"}
                strokeWidth={Math.max(0.05, 3 / size)}
                strokeDasharray={`${0.4} ${0.2}`}
              />
            )}
            {preview && tool === "circle" && (
              <ellipse
                cx={preview.x + preview.w / 2}
                cy={preview.y + preview.h / 2}
                rx={preview.w / 2}
                ry={preview.h / 2}
                fill={TILES[terrainId]?.color ?? "#888"}
                fillOpacity={0.4}
                stroke={TILES[terrainId]?.color ?? "#888"}
                strokeWidth={Math.max(0.05, 3 / size)}
                strokeDasharray={`${0.4} ${0.2}`}
              />
            )}

            {/* 객체 레이어 */}
            {layers.objects &&
              objects.map((m) => {
                const isSel = selectedObjectId === m.id;
                return (
                  <text
                    key={m.id}
                    x={m.x + 0.5}
                    y={m.y + 0.85}
                    textAnchor="middle"
                    fontSize={1}
                    style={{
                      filter: isSel
                        ? "drop-shadow(0 0 0.4px var(--space-accent))"
                        : "drop-shadow(0 0.05px 0.1px rgba(0,0,0,0.5))",
                    }}
                  >
                    {m.emoji}
                  </text>
                );
              })}

            {/* 텍스트 레이어 */}
            {layers.texts &&
              texts.map((t) => {
                const isSel = selectedTextId === t.id;
                const fs = (size / 18) * t.size;
                return (
                  <text
                    key={t.id}
                    x={t.x}
                    y={t.y}
                    fontSize={fs}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontWeight={600}
                    fill={t.color}
                    paintOrder="stroke"
                    stroke="rgba(255,255,255,0.85)"
                    strokeWidth={fs * 0.18}
                    style={{
                      filter: isSel
                        ? "drop-shadow(0 0 0.4px var(--space-accent))"
                        : undefined,
                    }}
                  >
                    {t.text}
                  </text>
                );
              })}
          </svg>
        </div>

        {/* 우측 패널 */}
        <aside
          className="rounded-xl p-4 border h-fit space-y-4"
          style={{
            background: "var(--space-card)",
            borderColor: "var(--space-border)",
          }}
        >
          {tool === "select" && selObj ? (
            <ObjectPanel
              marker={selObj}
              onUpdate={updateSelectedObject}
              onRemove={removeSelectedObject}
              disabled={!editMode || !isOwner}
            />
          ) : tool === "select" && selText ? (
            <TextPanel
              label={selText}
              onUpdate={updateSelectedText}
              onRemove={removeSelectedText}
              disabled={!editMode || !isOwner}
            />
          ) : editMode && isOwner && tool === "object" ? (
            <ObjectPalette
              value={pendingEmoji}
              onChange={setPendingEmoji}
            />
          ) : editMode && isOwner ? (
            <TilePalette
              value={terrainId}
              onChange={setTerrainId}
              tool={tool}
              brush={brushSize}
            />
          ) : (
            <div
              className="text-sm text-center py-6"
              style={{ color: "var(--space-fg-soft)" }}
            >
              <p className="mb-2">
                {terrain.filter((t) => t !== 0).length}타일 · 객체{" "}
                {objects.length} · 텍스트 {texts.length}
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

// ─── 보조: 가까운 항목 찾기 ───
function nearestObject(p: Pt, list: ObjMarker[], maxD: number) {
  let best: { id: string; d: number } | null = null;
  for (const m of list) {
    const d = Math.hypot(m.x + 0.5 - p.x, m.y + 0.5 - p.y);
    if (d < maxD && (!best || d < best.d)) best = { id: m.id, d };
  }
  return best;
}
function nearestText(p: Pt, list: TextLabel[], maxD: number) {
  let best: { id: string; d: number } | null = null;
  for (const t of list) {
    const d = Math.hypot(t.x - p.x, t.y - p.y);
    if (d < maxD && (!best || d < best.d)) best = { id: t.id, d };
  }
  return best;
}
function zoomBy(
  setVb: React.Dispatch<React.SetStateAction<{ x: number; y: number; w: number; h: number }>>,
  vb: { x: number; y: number; w: number; h: number },
  factor: number
) {
  const cx = vb.x + vb.w / 2;
  const cy = vb.y + vb.h / 2;
  const newW = Math.max(4, vb.w * factor);
  const newH = Math.max(4, vb.h * factor);
  setVb({
    x: cx - newW / 2,
    y: cy - newH / 2,
    w: newW,
    h: newH,
  });
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

function TilePalette({
  value,
  onChange,
  tool,
  brush,
}: {
  value: number;
  onChange: (id: number) => void;
  tool: Tool;
  brush: number;
}) {
  return (
    <div>
      <p
        className="text-xs font-medium mb-2"
        style={{ color: "var(--space-fg-muted)" }}
      >
        지형 팔레트
      </p>
      {CATEGORIES.map((cat) => (
        <div key={cat.name} className="mb-3">
          <p
            className="text-[10px] uppercase tracking-wider mb-1"
            style={{ color: "var(--space-fg-soft)" }}
          >
            {cat.name}
          </p>
          <div className="grid grid-cols-3 gap-1.5">
            {cat.ids.map((tid) => {
              const t = TILES[tid];
              if (!t) return null;
              const active = value === tid;
              return (
                <button
                  key={tid}
                  onClick={() => onChange(tid)}
                  className="rounded border p-1 text-[10px] flex flex-col items-center gap-0.5"
                  style={{
                    borderColor: active
                      ? "var(--space-accent)"
                      : "var(--space-border)",
                    outline: active ? "2px solid var(--space-accent)" : "none",
                  }}
                >
                  <span
                    className="block w-full h-5 rounded"
                    style={{ background: t.color }}
                  />
                  <span style={{ color: "var(--space-fg-muted)" }}>{t.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <p
        className="text-xs mt-2"
        style={{ color: "var(--space-fg-soft)" }}
      >
        {tool === "paint" && `🖌️ ${brush}×${brush} 브러시로 페인트`}
        {tool === "eraser" && `🧹 ${brush}×${brush} 브러시로 지우기`}
        {tool === "rect" && "▭ 클릭·드래그로 사각형 구역"}
        {tool === "circle" && "◯ 클릭·드래그로 원형 구역"}
        {tool === "fill" && "🪣 같은 색 영역을 한 번에"}
        {tool === "moveRegion" && "✋ 같은 색 영역을 잡고 드래그로 이동"}
        {tool === "text" && "📝 클릭한 자리에 텍스트"}
        {tool === "select" && "↖ 객체/텍스트 클릭해 선택"}
      </p>
    </div>
  );
}

function ObjectPalette({
  value,
  onChange,
}: {
  value: string;
  onChange: (em: string) => void;
}) {
  return (
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
            onClick={() => onChange(em)}
            className="text-xl p-1 rounded"
            style={
              value === em
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
  );
}

function ObjectPanel({
  marker,
  onUpdate,
  onRemove,
  disabled,
}: {
  marker: ObjMarker;
  onUpdate: (patch: Partial<ObjMarker>) => void;
  onRemove: () => void;
  disabled: boolean;
}) {
  return (
    <div>
      <p
        className="text-xs font-medium mb-2"
        style={{ color: "var(--space-fg-muted)" }}
      >
        🎨 선택된 객체
      </p>
      <label className="block text-xs mb-1" style={{ color: "var(--space-fg-muted)" }}>
        이모지
      </label>
      <input
        type="text"
        value={marker.emoji}
        onChange={(e) => onUpdate({ emoji: e.target.value })}
        disabled={disabled}
        maxLength={4}
        className="w-full rounded border px-2 py-1 text-xl text-center mb-2"
        style={{
          background: "var(--space-bg)",
          borderColor: "var(--space-border)",
          color: "var(--space-fg)",
        }}
      />
      <label className="block text-xs mb-1" style={{ color: "var(--space-fg-muted)" }}>
        이름 (선택)
      </label>
      <input
        type="text"
        value={marker.name ?? ""}
        onChange={(e) => onUpdate({ name: e.target.value })}
        disabled={disabled}
        className="w-full rounded border px-2 py-1 text-sm mb-3"
        style={{
          background: "var(--space-bg)",
          borderColor: "var(--space-border)",
          color: "var(--space-fg)",
        }}
      />
      <p className="text-xs mb-3" style={{ color: "var(--space-fg-soft)" }}>
        위치: ({marker.x}, {marker.y}) · 캔버스에서 드래그로 이동
      </p>
      {!disabled && (
        <button
          onClick={onRemove}
          className="w-full rounded px-2 py-1 text-xs"
          style={{ background: "rgba(229,91,91,0.15)", color: "#e55b5b" }}
        >
          삭제
        </button>
      )}
    </div>
  );
}

function TextPanel({
  label,
  onUpdate,
  onRemove,
  disabled,
}: {
  label: TextLabel;
  onUpdate: (patch: Partial<TextLabel>) => void;
  onRemove: () => void;
  disabled: boolean;
}) {
  return (
    <div>
      <p
        className="text-xs font-medium mb-2"
        style={{ color: "var(--space-fg-muted)" }}
      >
        📝 선택된 텍스트
      </p>
      <label className="block text-xs mb-1" style={{ color: "var(--space-fg-muted)" }}>
        내용
      </label>
      <input
        type="text"
        value={label.text}
        onChange={(e) => onUpdate({ text: e.target.value })}
        disabled={disabled}
        className="w-full rounded border px-2 py-1 text-sm mb-2"
        style={{
          background: "var(--space-bg)",
          borderColor: "var(--space-border)",
          color: "var(--space-fg)",
        }}
      />
      <label className="block text-xs mb-1" style={{ color: "var(--space-fg-muted)" }}>
        크기 ({label.size.toFixed(1)})
      </label>
      <input
        type="range"
        min={0.5}
        max={4}
        step={0.1}
        value={label.size}
        onChange={(e) => onUpdate({ size: parseFloat(e.target.value) })}
        disabled={disabled}
        className="w-full mb-2"
      />
      <div className="flex gap-2 flex-wrap mb-3">
        {TEXT_COLORS.map((c) => (
          <button
            key={c}
            onClick={() => onUpdate({ color: c })}
            disabled={disabled}
            className="h-6 w-6 rounded-full"
            style={{
              background: c,
              outline:
                label.color === c ? "2px solid var(--space-accent)" : "none",
            }}
          />
        ))}
        <input
          type="color"
          value={label.color}
          onChange={(e) => onUpdate({ color: e.target.value })}
          disabled={disabled}
          className="h-6 w-8 cursor-pointer"
        />
      </div>
      {!disabled && (
        <button
          onClick={onRemove}
          className="w-full rounded px-2 py-1 text-xs"
          style={{ background: "rgba(229,91,91,0.15)", color: "#e55b5b" }}
        >
          삭제
        </button>
      )}
    </div>
  );
}
