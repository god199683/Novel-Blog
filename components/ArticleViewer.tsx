"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

type Props = {
  html: string;
  title: string;
  authorName: string;
  prevHref?: string | null;
  prevTitle?: string | null;
  nextHref?: string | null;
  nextTitle?: string | null;
};

const FS_KEY = "nb_reader_fontSize";
const FONT_KEY = "nb_reader_fontFamily";
const BOOK_KEY = "nb_reader_book_open";

const FONT_OPTIONS = [
  { label: "명조", value: "'Noto Serif KR', 'Iowan Old Style', Georgia, serif" },
  { label: "고딕", value: "'Pretendard', system-ui, sans-serif" },
  { label: "손글씨", value: "'Nanum Pen Script', 'Noto Serif KR', cursive" },
];

export default function ArticleViewer({
  html,
  title,
  authorName,
  prevHref,
  prevTitle,
  nextHref,
  nextTitle,
}: Props) {
  const router = useRouter();
  const [book, setBook] = useState(false);
  const [page, setPage] = useState(0);
  const [pageCount, setPageCount] = useState(1);
  const [fontSize, setFontSize] = useState(18);
  const [fontFamily, setFontFamily] = useState(FONT_OPTIONS[0].value);
  const stageRef = useRef<HTMLDivElement>(null);
  const pagesRef = useRef<HTMLDivElement>(null);
  const [stageW, setStageW] = useState(0);

  // Load saved prefs + restore book mode across post navigation
  useEffect(() => {
    const fs = window.localStorage.getItem(FS_KEY);
    if (fs) {
      const n = parseInt(fs, 10);
      if (!Number.isNaN(n)) setFontSize(n);
    }
    const ff = window.localStorage.getItem(FONT_KEY);
    if (ff) setFontFamily(ff);
    if (window.sessionStorage.getItem(BOOK_KEY) === "1") setBook(true);
  }, []);
  useEffect(() => {
    window.localStorage.setItem(FS_KEY, String(fontSize));
  }, [fontSize]);
  useEffect(() => {
    window.localStorage.setItem(FONT_KEY, fontFamily);
  }, [fontFamily]);

  const openBook = () => {
    setBook(true);
    try {
      window.sessionStorage.setItem(BOOK_KEY, "1");
    } catch {}
  };
  const closeBook = () => {
    setBook(false);
    try {
      window.sessionStorage.removeItem(BOOK_KEY);
    } catch {}
  };

  // Track stage size
  useEffect(() => {
    if (!book || !stageRef.current) return;
    const el = stageRef.current;
    const update = () => setStageW(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [book]);

  // Recompute page count after layout
  useEffect(() => {
    if (!book) return;
    const t = setTimeout(() => {
      if (!pagesRef.current || !stageRef.current) return;
      const w = stageRef.current.clientWidth;
      if (w <= 0) return;
      const sw = pagesRef.current.scrollWidth;
      const total = Math.max(1, Math.round(sw / w));
      setPageCount(total);
      setPage((p) => Math.min(p, total - 1));
    }, 80);
    return () => clearTimeout(t);
  }, [book, fontSize, fontFamily, stageW, html]);

  // Boundary-aware navigation: at last page, "next" jumps to the next
  // post within the folder; at first page, "prev" jumps to the prior.
  const jumpToSibling = useCallback(
    (href: string) => {
      try {
        window.sessionStorage.setItem(BOOK_KEY, "1");
      } catch {}
      router.push(href);
    },
    [router]
  );

  const goNext = useCallback(() => {
    setPage((p) => {
      if (p < pageCount - 1) return p + 1;
      if (nextHref) jumpToSibling(nextHref);
      return p;
    });
  }, [pageCount, nextHref, jumpToSibling]);

  const goPrev = useCallback(() => {
    setPage((p) => {
      if (p > 0) return p - 1;
      if (prevHref) jumpToSibling(prevHref);
      return p;
    });
  }, [prevHref, jumpToSibling]);

  // Keyboard nav
  useEffect(() => {
    if (!book) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "PageDown" || e.key === " ") {
        e.preventDefault();
        goNext();
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        goPrev();
      } else if (e.key === "Escape") {
        closeBook();
      } else if (e.key === "Home") {
        setPage(0);
      } else if (e.key === "End") {
        setPage(pageCount - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [book, pageCount, goNext, goPrev]);

  // Lock body scroll
  useEffect(() => {
    if (book) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [book]);

  // Touch swipe
  useEffect(() => {
    if (!book || !stageRef.current) return;
    const el = stageRef.current;
    let startX = 0;
    let active = false;
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      startX = e.touches[0].clientX;
      active = true;
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (!active) return;
      active = false;
      const endX = e.changedTouches[0]?.clientX ?? startX;
      const dx = endX - startX;
      if (Math.abs(dx) > 40) {
        if (dx < 0) goNext();
        else goPrev();
      }
    };
    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchend", onTouchEnd);
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, [book, goNext, goPrev]);

  if (!book) {
    return (
      <>
        <div className="mb-4 flex justify-end">
          <button
            type="button"
            onClick={openBook}
            className="rounded-full border border-sky-200 px-3 py-1.5 text-sm text-slate-700 hover:border-brand hover:text-brand"
          >
            📖 책으로 보기
          </button>
        </div>
        <div className="article-body" dangerouslySetInnerHTML={{ __html: html }} />
      </>
    );
  }

  const PAD = 48;
  const colW = Math.max(120, stageW - PAD * 2);
  const atFirst = page === 0;
  const atLast = page >= pageCount - 1;
  const canGoPrev = !atFirst || !!prevHref;
  const canGoNext = !atLast || !!nextHref;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#faf5e8] text-[#3a3026]">
      <header className="flex items-center justify-between gap-3 border-b border-amber-200/60 bg-[#f5edd8] px-4 py-3">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-semibold">{title}</h2>
          <p className="truncate text-xs text-stone-500">{authorName}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1 text-sm">
          <select
            title="글씨체"
            value={fontFamily}
            onChange={(e) => setFontFamily(e.target.value)}
            className="rounded border border-amber-200 bg-white/70 px-1 py-1 text-xs text-stone-700"
          >
            {FONT_OPTIONS.map((f) => (
              <option key={f.label} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setFontSize((s) => Math.max(12, s - 1))}
            title="글자 작게"
            className="rounded px-2 py-1 hover:bg-amber-100"
          >
            A−
          </button>
          <span className="w-10 text-center text-xs text-stone-500">{fontSize}px</span>
          <button
            type="button"
            onClick={() => setFontSize((s) => Math.min(28, s + 1))}
            title="글자 크게"
            className="rounded px-2 py-1 hover:bg-amber-100"
          >
            A+
          </button>
          <button
            type="button"
            onClick={closeBook}
            title="닫기 (Esc)"
            className="ml-2 rounded px-2 py-1 hover:bg-amber-100"
          >
            ✕
          </button>
        </div>
      </header>

      <div ref={stageRef} className="relative flex-1 overflow-hidden">
        {/* Click zones */}
        <button
          type="button"
          onClick={goPrev}
          disabled={!canGoPrev}
          aria-label="이전 페이지"
          className="absolute inset-y-0 left-0 z-10 w-1/3 cursor-w-resize disabled:cursor-default"
        />
        <button
          type="button"
          onClick={goNext}
          disabled={!canGoNext}
          aria-label="다음 페이지"
          className="absolute inset-y-0 right-0 z-10 w-1/3 cursor-e-resize disabled:cursor-default"
        />

        {stageW > 0 && (
          <div
            style={{
              height: "100%",
              paddingTop: 32,
              paddingBottom: 32,
              boxSizing: "border-box",
            }}
          >
            <div
              ref={pagesRef}
              className="book-pages"
              style={{
                columnWidth: `${colW}px`,
                columnGap: `${PAD * 2}px`,
                paddingLeft: PAD,
                paddingRight: PAD,
                boxSizing: "border-box",
                height: "100%",
                fontSize: `${fontSize}px`,
                lineHeight: 1.85,
                transition: "transform 320ms ease",
                transform: `translateX(-${page * stageW}px)`,
                fontFamily,
                color: "#3a3026",
              }}
              dangerouslySetInnerHTML={{ __html: html }}
            />
          </div>
        )}

        <button
          type="button"
          onClick={goPrev}
          disabled={!canGoPrev}
          aria-label={atFirst && prevHref ? `이전편: ${prevTitle ?? ""}` : "이전"}
          title={
            atFirst && prevHref
              ? `이전편으로: ${prevTitle ?? ""}`
              : "이전 페이지"
          }
          className="absolute left-3 top-1/2 z-20 -translate-y-1/2 rounded-full bg-white/90 px-3 py-2 text-stone-700 shadow ring-1 ring-stone-200 hover:bg-white disabled:opacity-30"
        >
          {atFirst && prevHref ? "⇤" : "←"}
        </button>
        <button
          type="button"
          onClick={goNext}
          disabled={!canGoNext}
          aria-label={atLast && nextHref ? `다음편: ${nextTitle ?? ""}` : "다음"}
          title={
            atLast && nextHref
              ? `다음편으로: ${nextTitle ?? ""}`
              : "다음 페이지"
          }
          className="absolute right-3 top-1/2 z-20 -translate-y-1/2 rounded-full bg-white/90 px-3 py-2 text-stone-700 shadow ring-1 ring-stone-200 hover:bg-white disabled:opacity-30"
        >
          {atLast && nextHref ? "⇥" : "→"}
        </button>
      </div>

      <footer className="flex flex-col items-center gap-2 border-t border-amber-200/60 bg-[#f5edd8] px-4 py-2 text-xs text-stone-600">
        {(prevHref || nextHref) && (
          <div className="flex w-full max-w-2xl items-center justify-between gap-3">
            <div className="min-w-0 flex-1 text-left">
              {prevHref && prevTitle ? (
                <button
                  type="button"
                  onClick={() => jumpToSibling(prevHref)}
                  className="max-w-full truncate rounded px-2 py-1 text-stone-600 hover:bg-amber-100"
                  title={prevTitle}
                >
                  ← 이전편: <span className="font-medium">{prevTitle}</span>
                </button>
              ) : (
                <span className="px-2 text-stone-400">— 이전편 없음</span>
              )}
            </div>
            <div className="min-w-0 flex-1 text-right">
              {nextHref && nextTitle ? (
                <button
                  type="button"
                  onClick={() => jumpToSibling(nextHref)}
                  className="max-w-full truncate rounded px-2 py-1 text-stone-600 hover:bg-amber-100"
                  title={nextTitle}
                >
                  다음편: <span className="font-medium">{nextTitle}</span> →
                </button>
              ) : (
                <span className="px-2 text-stone-400">다음편 없음 —</span>
              )}
            </div>
          </div>
        )}
        <div className="flex items-center gap-4">
          <input
            type="range"
            min={0}
            max={Math.max(0, pageCount - 1)}
            value={page}
            onChange={(e) => setPage(parseInt(e.target.value, 10))}
            className="h-1 w-48 accent-amber-600"
          />
          <span className="tabular-nums">
            {page + 1} / {pageCount}
          </span>
        </div>
      </footer>
    </div>
  );
}
