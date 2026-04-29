"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  MapPin,
  MapRect,
  MapLine,
  MapData,
} from "@/lib/supabase";

type Tool = "select" | "pin" | "rect" | "line";

type Selection =
  | { kind: "pin"; id: string }
  | { kind: "rect"; id: string }
  | { kind: "line"; id: string }
  | null;

type Props = {
  initialTitle: string;
  initialData: MapData;
  initialWidth: number;
  initialHeight: number;
  initialBackground: string;
  initialPublished: boolean;
  readOnly?: boolean;
  saving?: boolean;
  onSave?: (payload: {
    title: string;
    data: MapData;
    width: number;
    height: number;
    background_color: string;
    published: boolean;
  }) => Promise<void> | void;
  onDelete?: () => void;
};

const DEFAULT_PIN_COLORS = ["#dc2626", "#2563eb", "#16a34a", "#ca8a04", "#9333ea", "#0f172a"];
const GRID_SIZE = 20;

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function ensureData(d: Partial<MapData> | undefined): MapData {
  return {
    pins: d?.pins ?? [],
    rects: d?.rects ?? [],
    lines: d?.lines ?? [],
  };
}

export default function MapEditor({
  initialTitle,
  initialData,
  initialWidth,
  initialHeight,
  initialBackground,
  initialPublished,
  readOnly = false,
  saving = false,
  onSave,
  onDelete,
}: Props) {
  const [title, setTitle] = useState(initialTitle);
  const [data, setData] = useState<MapData>(ensureData(initialData));
  const [bg, setBg] = useState(initialBackground);
  const [published, setPublished] = useState(initialPublished);
  const [tool, setTool] = useState<Tool>("select");
  const [selection, setSelection] = useState<Selection>(null);
  const [showGrid, setShowGrid] = useState(true);
  const [pinColor, setPinColor] = useState(DEFAULT_PIN_COLORS[0]);

  const svgRef = useRef<SVGSVGElement | null>(null);
  // 드래그/드로우 임시 상태
  const drawingRef = useRef<{
    start: { x: number; y: number };
    kind: "rect" | "line";
    id: string;
  } | null>(null);
  const dragRef = useRef<{
    kind: "pin" | "rect" | "line-end";
    id: string;
    handle?: "start" | "end";
    offsetX: number;
    offsetY: number;
  } | null>(null);
  // 드래그 중 미리보기는 상태로 관리해서 리렌더 트리거
  const [drawPreview, setDrawPreview] = useState<
    | { kind: "rect"; x: number; y: number; width: number; height: number }
    | { kind: "line"; x1: number; y1: number; x2: number; y2: number }
    | null
  >(null);

  const width = initialWidth;
  const height = initialHeight;

  // SVG 좌표 변환
  const svgPoint = useCallback((evt: React.MouseEvent | MouseEvent) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    const x = ((evt.clientX - rect.left) / rect.width) * width;
    const y = ((evt.clientY - rect.top) / rect.height) * height;
    return { x: Math.round(x), y: Math.round(y) };
  }, [width, height]);

  // ----- 클릭/드래그 핸들러 -----
  const onCanvasMouseDown = (e: React.MouseEvent) => {
    if (readOnly) return;
    if (e.button !== 0) return;
    const pt = svgPoint(e);

    if (tool === "pin") {
      const name = window.prompt("핀 이름", "");
      if (!name) return;
      const pin: MapPin = {
        id: uid(),
        x: pt.x,
        y: pt.y,
        name: name.trim(),
        color: pinColor,
      };
      setData((d) => ({ ...d, pins: [...d.pins, pin] }));
      setTool("select");
      setSelection({ kind: "pin", id: pin.id });
      return;
    }

    if (tool === "rect") {
      const id = uid();
      drawingRef.current = { start: pt, kind: "rect", id };
      setDrawPreview({ kind: "rect", x: pt.x, y: pt.y, width: 0, height: 0 });
      return;
    }

    if (tool === "line") {
      const id = uid();
      drawingRef.current = { start: pt, kind: "line", id };
      setDrawPreview({ kind: "line", x1: pt.x, y1: pt.y, x2: pt.x, y2: pt.y });
      return;
    }

    // select 모드 — 빈 곳 클릭 시 선택 해제
    setSelection(null);
  };

  const onCanvasMouseMove = (e: React.MouseEvent) => {
    if (readOnly) return;
    const pt = svgPoint(e);

    // 새 도형 그리는 중
    if (drawingRef.current) {
      const d = drawingRef.current;
      if (d.kind === "rect") {
        const x = Math.min(d.start.x, pt.x);
        const y = Math.min(d.start.y, pt.y);
        const w = Math.abs(pt.x - d.start.x);
        const h = Math.abs(pt.y - d.start.y);
        setDrawPreview({ kind: "rect", x, y, width: w, height: h });
      } else if (d.kind === "line") {
        setDrawPreview({
          kind: "line",
          x1: d.start.x,
          y1: d.start.y,
          x2: pt.x,
          y2: pt.y,
        });
      }
      return;
    }

    // 기존 항목 드래그
    if (dragRef.current) {
      const d = dragRef.current;
      if (d.kind === "pin") {
        const newX = pt.x - d.offsetX;
        const newY = pt.y - d.offsetY;
        setData((cur) => ({
          ...cur,
          pins: cur.pins.map((p) =>
            p.id === d.id ? { ...p, x: newX, y: newY } : p
          ),
        }));
      } else if (d.kind === "rect") {
        setData((cur) => ({
          ...cur,
          rects: cur.rects.map((r) =>
            r.id === d.id
              ? { ...r, x: pt.x - d.offsetX, y: pt.y - d.offsetY }
              : r
          ),
        }));
      } else if (d.kind === "line-end") {
        setData((cur) => ({
          ...cur,
          lines: cur.lines.map((l) =>
            l.id === d.id
              ? d.handle === "start"
                ? { ...l, x1: pt.x, y1: pt.y }
                : { ...l, x2: pt.x, y2: pt.y }
              : l
          ),
        }));
      }
    }
  };

  const onCanvasMouseUp = (e: React.MouseEvent) => {
    if (readOnly) return;
    const pt = svgPoint(e);

    if (drawingRef.current) {
      const d = drawingRef.current;
      if (d.kind === "rect") {
        const x = Math.min(d.start.x, pt.x);
        const y = Math.min(d.start.y, pt.y);
        const w = Math.abs(pt.x - d.start.x);
        const h = Math.abs(pt.y - d.start.y);
        if (w > 5 && h > 5) {
          const rect: MapRect = {
            id: d.id,
            x,
            y,
            width: w,
            height: h,
            color: "#94a3b8",
            label: "",
          };
          setData((cur) => ({ ...cur, rects: [...cur.rects, rect] }));
          setSelection({ kind: "rect", id: d.id });
        }
      } else if (d.kind === "line") {
        const dx = pt.x - d.start.x;
        const dy = pt.y - d.start.y;
        if (Math.hypot(dx, dy) > 5) {
          const line: MapLine = {
            id: d.id,
            x1: d.start.x,
            y1: d.start.y,
            x2: pt.x,
            y2: pt.y,
            color: "#0f172a",
            thickness: 2,
          };
          setData((cur) => ({ ...cur, lines: [...cur.lines, line] }));
          setSelection({ kind: "line", id: d.id });
        }
      }
      drawingRef.current = null;
      setDrawPreview(null);
      setTool("select");
    }

    if (dragRef.current) {
      dragRef.current = null;
    }
  };

  // 키보드 — 선택된 항목 삭제
  useEffect(() => {
    if (readOnly) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "Delete" || e.key === "Backspace") && selection) {
        const t = e.target as HTMLElement;
        if (t.tagName === "INPUT" || t.tagName === "TEXTAREA") return;
        deleteSelected();
      } else if (e.key === "Escape") {
        setSelection(null);
        setTool("select");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selection, readOnly]);

  const deleteSelected = () => {
    if (!selection) return;
    if (selection.kind === "pin") {
      setData((d) => ({ ...d, pins: d.pins.filter((p) => p.id !== selection.id) }));
    } else if (selection.kind === "rect") {
      setData((d) => ({ ...d, rects: d.rects.filter((r) => r.id !== selection.id) }));
    } else {
      setData((d) => ({ ...d, lines: d.lines.filter((l) => l.id !== selection.id) }));
    }
    setSelection(null);
  };

  // 선택된 객체 메타 (속성 편집 패널용)
  const selected = useMemo(() => {
    if (!selection) return null;
    if (selection.kind === "pin")
      return data.pins.find((p) => p.id === selection.id) ?? null;
    if (selection.kind === "rect")
      return data.rects.find((r) => r.id === selection.id) ?? null;
    return data.lines.find((l) => l.id === selection.id) ?? null;
  }, [selection, data]);

  const updateSelected = (patch: Record<string, unknown>) => {
    if (!selection) return;
    setData((cur) => {
      if (selection.kind === "pin") {
        return {
          ...cur,
          pins: cur.pins.map((p) =>
            p.id === selection.id ? { ...p, ...patch } : p
          ),
        };
      }
      if (selection.kind === "rect") {
        return {
          ...cur,
          rects: cur.rects.map((r) =>
            r.id === selection.id ? { ...r, ...patch } : r
          ),
        };
      }
      return {
        ...cur,
        lines: cur.lines.map((l) =>
          l.id === selection.id ? { ...l, ...patch } : l
        ),
      };
    });
  };

  // ----- 항목별 mousedown으로 드래그 시작 -----
  const startPinDrag = (e: React.MouseEvent, p: MapPin) => {
    if (readOnly || tool !== "select") return;
    e.stopPropagation();
    setSelection({ kind: "pin", id: p.id });
    const pt = svgPoint(e);
    dragRef.current = {
      kind: "pin",
      id: p.id,
      offsetX: pt.x - p.x,
      offsetY: pt.y - p.y,
    };
  };

  const startRectDrag = (e: React.MouseEvent, r: MapRect) => {
    if (readOnly || tool !== "select") return;
    e.stopPropagation();
    setSelection({ kind: "rect", id: r.id });
    const pt = svgPoint(e);
    dragRef.current = {
      kind: "rect",
      id: r.id,
      offsetX: pt.x - r.x,
      offsetY: pt.y - r.y,
    };
  };

  const startLineEndDrag = (
    e: React.MouseEvent,
    l: MapLine,
    handle: "start" | "end"
  ) => {
    if (readOnly || tool !== "select") return;
    e.stopPropagation();
    setSelection({ kind: "line", id: l.id });
    dragRef.current = {
      kind: "line-end",
      id: l.id,
      handle,
      offsetX: 0,
      offsetY: 0,
    };
  };

  const onLineClick = (e: React.MouseEvent, l: MapLine) => {
    if (readOnly || tool !== "select") return;
    e.stopPropagation();
    setSelection({ kind: "line", id: l.id });
  };

  const handleSave = () => {
    if (!onSave) return;
    onSave({
      title: title.trim() || "제목 없는 지도",
      data,
      width,
      height,
      background_color: bg,
      published,
    });
  };

  return (
    <div className="space-y-3">
      {/* 상단 — 제목 + 도구 모음 */}
      {!readOnly && (
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="지도 이름"
            className="flex-1 min-w-[200px] rounded border border-sky-200 bg-white px-3 py-2 text-lg font-semibold text-slate-800 outline-none focus:border-brand"
          />
          <button
            type="button"
            onClick={() => setPublished((p) => !p)}
            className={`rounded-full px-3 py-1 text-xs ${
              published
                ? "bg-brand text-white"
                : "bg-amber-500 text-white"
            }`}
          >
            {published ? "🌐 공개" : "🔒 비공개"}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-full bg-brand px-5 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50"
          >
            {saving ? "저장 중..." : "저장"}
          </button>
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="rounded px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
            >
              삭제
            </button>
          )}
        </div>
      )}

      {!readOnly && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-sky-100 bg-white px-2 py-1.5 text-sm">
          <ToolBtn label="선택" active={tool === "select"} onClick={() => setTool("select")}>↖</ToolBtn>
          <ToolBtn label="핀" active={tool === "pin"} onClick={() => setTool("pin")}>📍</ToolBtn>
          <ToolBtn label="방" active={tool === "rect"} onClick={() => setTool("rect")}>▭</ToolBtn>
          <ToolBtn label="선" active={tool === "line"} onClick={() => setTool("line")}>╱</ToolBtn>
          <span className="mx-1 h-5 w-px bg-slate-200" />
          <button
            type="button"
            onClick={() => setShowGrid((g) => !g)}
            className={`rounded px-2 py-1 text-xs ${
              showGrid ? "bg-sky-100 text-slate-700" : "text-slate-500 hover:bg-sky-50"
            }`}
            title="격자"
          >
            #
          </button>
          <span className="mx-1 h-5 w-px bg-slate-200" />
          <span className="text-xs text-slate-500">핀 색</span>
          {DEFAULT_PIN_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setPinColor(c)}
              style={{ background: c }}
              className={`h-5 w-5 rounded-full ring-2 ${
                pinColor === c ? "ring-slate-700" : "ring-transparent"
              }`}
              aria-label={c}
            />
          ))}
          <span className="mx-1 h-5 w-px bg-slate-200" />
          <label className="flex items-center gap-1 text-xs text-slate-500">
            배경
            <input
              type="color"
              value={bg}
              onChange={(e) => setBg(e.target.value)}
              className="h-6 w-8 cursor-pointer rounded border border-slate-200"
            />
          </label>
          {selection && (
            <>
              <span className="mx-1 h-5 w-px bg-slate-200" />
              <button
                type="button"
                onClick={deleteSelected}
                className="rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50"
              >
                선택 삭제
              </button>
            </>
          )}
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-[1fr_220px]">
        {/* 캔버스 */}
        <div className="overflow-auto rounded-lg border border-sky-100 bg-white">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${width} ${height}`}
            preserveAspectRatio="xMidYMid meet"
            onMouseDown={onCanvasMouseDown}
            onMouseMove={onCanvasMouseMove}
            onMouseUp={onCanvasMouseUp}
            onMouseLeave={onCanvasMouseUp}
            style={{
              background: bg,
              cursor:
                tool === "select"
                  ? "default"
                  : tool === "pin"
                  ? "crosshair"
                  : "crosshair",
              width: "100%",
              height: "auto",
              maxHeight: "75vh",
              userSelect: "none",
            }}
          >
            {/* 격자 */}
            {showGrid && (
              <defs>
                <pattern
                  id="grid-pattern"
                  width={GRID_SIZE}
                  height={GRID_SIZE}
                  patternUnits="userSpaceOnUse"
                >
                  <path
                    d={`M ${GRID_SIZE} 0 L 0 0 0 ${GRID_SIZE}`}
                    fill="none"
                    stroke="rgba(0,0,0,0.07)"
                    strokeWidth="1"
                  />
                </pattern>
              </defs>
            )}
            {showGrid && (
              <rect
                x={0}
                y={0}
                width={width}
                height={height}
                fill="url(#grid-pattern)"
                pointerEvents="none"
              />
            )}

            {/* 사각형 */}
            {data.rects.map((r) => {
              const isSel =
                selection?.kind === "rect" && selection.id === r.id;
              return (
                <g key={r.id}>
                  <rect
                    x={r.x}
                    y={r.y}
                    width={r.width}
                    height={r.height}
                    fill={r.color}
                    fillOpacity={0.2}
                    stroke={r.color}
                    strokeWidth={isSel ? 3 : 2}
                    onMouseDown={(e) => startRectDrag(e, r)}
                    style={{
                      cursor: tool === "select" ? "move" : "default",
                    }}
                  />
                  {r.label && (
                    <text
                      x={r.x + r.width / 2}
                      y={r.y + r.height / 2}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill={r.color}
                      fontSize={Math.max(12, Math.min(r.width, r.height) / 6)}
                      fontWeight="600"
                      pointerEvents="none"
                    >
                      {r.label}
                    </text>
                  )}
                </g>
              );
            })}

            {/* 선 */}
            {data.lines.map((l) => {
              const isSel =
                selection?.kind === "line" && selection.id === l.id;
              return (
                <g key={l.id}>
                  <line
                    x1={l.x1}
                    y1={l.y1}
                    x2={l.x2}
                    y2={l.y2}
                    stroke={l.color}
                    strokeWidth={l.thickness + (isSel ? 1 : 0)}
                    strokeLinecap="round"
                    onClick={(e) => onLineClick(e, l)}
                    style={{
                      cursor: tool === "select" ? "pointer" : "default",
                    }}
                  />
                  {/* 클릭 영역을 넓히기 위한 투명 선 */}
                  <line
                    x1={l.x1}
                    y1={l.y1}
                    x2={l.x2}
                    y2={l.y2}
                    stroke="transparent"
                    strokeWidth={Math.max(l.thickness + 8, 12)}
                    onClick={(e) => onLineClick(e, l)}
                    style={{
                      cursor: tool === "select" ? "pointer" : "default",
                    }}
                  />
                  {isSel && !readOnly && (
                    <>
                      <circle
                        cx={l.x1}
                        cy={l.y1}
                        r={5}
                        fill="white"
                        stroke={l.color}
                        strokeWidth={2}
                        onMouseDown={(e) => startLineEndDrag(e, l, "start")}
                        style={{ cursor: "grab" }}
                      />
                      <circle
                        cx={l.x2}
                        cy={l.y2}
                        r={5}
                        fill="white"
                        stroke={l.color}
                        strokeWidth={2}
                        onMouseDown={(e) => startLineEndDrag(e, l, "end")}
                        style={{ cursor: "grab" }}
                      />
                    </>
                  )}
                </g>
              );
            })}

            {/* 핀 */}
            {data.pins.map((p) => {
              const isSel =
                selection?.kind === "pin" && selection.id === p.id;
              return (
                <g
                  key={p.id}
                  onMouseDown={(e) => startPinDrag(e, p)}
                  style={{ cursor: tool === "select" ? "move" : "default" }}
                >
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={isSel ? 8 : 6}
                    fill={p.color}
                    stroke="white"
                    strokeWidth={2}
                  />
                  <text
                    x={p.x + 10}
                    y={p.y + 4}
                    fontSize={13}
                    fontWeight="600"
                    fill="#0f172a"
                    paintOrder="stroke"
                    stroke="white"
                    strokeWidth={3}
                    pointerEvents="none"
                  >
                    {p.name}
                  </text>
                </g>
              );
            })}

            {/* 그리는 중 미리보기 */}
            {drawPreview?.kind === "rect" && (
              <rect
                x={drawPreview.x}
                y={drawPreview.y}
                width={drawPreview.width}
                height={drawPreview.height}
                fill="rgba(148,163,184,0.2)"
                stroke="#94a3b8"
                strokeDasharray="4 2"
                strokeWidth={2}
                pointerEvents="none"
              />
            )}
            {drawPreview?.kind === "line" && (
              <line
                x1={drawPreview.x1}
                y1={drawPreview.y1}
                x2={drawPreview.x2}
                y2={drawPreview.y2}
                stroke="#0f172a"
                strokeWidth={2}
                strokeDasharray="4 2"
                pointerEvents="none"
              />
            )}
          </svg>
        </div>

        {/* 우측 속성 패널 */}
        {!readOnly && (
          <aside className="rounded-lg border border-sky-100 bg-white p-3 text-sm">
            {!selected ? (
              <div className="text-xs text-slate-500">
                <p className="mb-2 font-medium text-slate-700">사용법</p>
                <ul className="space-y-1">
                  <li>📍 핀: 캔버스 클릭 → 이름 입력</li>
                  <li>▭ 방: 클릭-드래그로 영역 그리기</li>
                  <li>╱ 선: 클릭-드래그로 벽/통로</li>
                  <li>↖ 선택: 클릭해 선택, 드래그로 이동</li>
                  <li>Delete 키: 선택 항목 삭제</li>
                </ul>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs font-medium text-slate-500">
                  {selection?.kind === "pin"
                    ? "핀"
                    : selection?.kind === "rect"
                    ? "사각형"
                    : "선"}{" "}
                  속성
                </p>
                {selection?.kind === "pin" && "name" in selected && (
                  <>
                    <label className="block text-xs text-slate-600">
                      이름
                      <input
                        type="text"
                        value={(selected as MapPin).name}
                        onChange={(e) => updateSelected({ name: e.target.value })}
                        className="mt-1 w-full rounded border border-sky-200 bg-white px-2 py-1 text-sm focus:border-brand focus:outline-none"
                      />
                    </label>
                    <label className="block text-xs text-slate-600">
                      메모
                      <textarea
                        value={(selected as MapPin).description ?? ""}
                        onChange={(e) =>
                          updateSelected({ description: e.target.value })
                        }
                        rows={3}
                        className="mt-1 w-full rounded border border-sky-200 bg-white px-2 py-1 text-sm focus:border-brand focus:outline-none"
                      />
                    </label>
                  </>
                )}
                {selection?.kind === "rect" && "label" in selected && (
                  <label className="block text-xs text-slate-600">
                    라벨
                    <input
                      type="text"
                      value={(selected as MapRect).label ?? ""}
                      onChange={(e) => updateSelected({ label: e.target.value })}
                      className="mt-1 w-full rounded border border-sky-200 bg-white px-2 py-1 text-sm focus:border-brand focus:outline-none"
                    />
                  </label>
                )}
                <label className="block text-xs text-slate-600">
                  색상
                  <input
                    type="color"
                    value={(selected as MapPin | MapRect | MapLine).color}
                    onChange={(e) => updateSelected({ color: e.target.value })}
                    className="ml-2 h-7 w-10 cursor-pointer align-middle"
                  />
                </label>
                {selection?.kind === "line" && "thickness" in selected && (
                  <label className="block text-xs text-slate-600">
                    굵기 {(selected as MapLine).thickness}px
                    <input
                      type="range"
                      min={1}
                      max={10}
                      value={(selected as MapLine).thickness}
                      onChange={(e) =>
                        updateSelected({ thickness: parseInt(e.target.value, 10) })
                      }
                      className="mt-1 w-full"
                    />
                  </label>
                )}
                <button
                  type="button"
                  onClick={deleteSelected}
                  className="w-full rounded border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                >
                  삭제
                </button>
              </div>
            )}
          </aside>
        )}
      </div>
    </div>
  );
}

function ToolBtn({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className={`flex items-center gap-1 rounded px-2 py-1 text-xs ${
        active
          ? "bg-brand text-white"
          : "text-slate-600 hover:bg-sky-50"
      }`}
    >
      <span>{children}</span>
      <span>{label}</span>
    </button>
  );
}
