"use client";

import type { SystemBlock, SystemDoc } from "@/lib/systemParser";

export default function SystemCard({ doc }: { doc: SystemDoc | null }) {
  if (!doc) {
    return (
      <div className="rounded-lg border border-dashed border-amber-200 bg-amber-50/50 p-6 text-center text-sm text-amber-700">
        붙여 넣은 텍스트를 인식하지 못했어요. <code className="rounded bg-white/70 px-1">[...]</code>로 감싸진 형식인지 확인해주세요.
      </div>
    );
  }

  return (
    <article className="rounded-2xl border border-sky-100 bg-gradient-to-br from-white to-sky-50/40 p-6 shadow-sm">
      <header className="mb-4 border-b border-sky-100 pb-3">
        <h1 className="text-2xl font-bold text-slate-900">⟁ {doc.title}</h1>
      </header>
      <div className="space-y-3">
        {doc.blocks.map((b, i) => (
          <BlockNode key={i} block={b} level={0} />
        ))}
      </div>
    </article>
  );
}

function BlockNode({ block, level }: { block: SystemBlock; level: number }) {
  if (block.type === "label") {
    // 최상위 label은 큰 섹션 헤더, 안쪽은 작은 라벨
    if (level === 0) {
      return (
        <section className="rounded-lg bg-white/70 p-3 ring-1 ring-sky-100">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-brand-dark">
            ◆ {block.text}
          </h2>
          {block.children.length > 0 && (
            <div className="space-y-2 pl-2">
              {block.children.map((c, i) => (
                <BlockNode key={i} block={c} level={level + 1} />
              ))}
            </div>
          )}
        </section>
      );
    }
    return (
      <div className="border-l-2 border-brand/30 pl-3">
        <p className="font-medium text-slate-800 whitespace-pre-line">
          ▸ {block.text}
        </p>
        {block.children.length > 0 && (
          <div className="mt-1 space-y-1.5 pl-2">
            {block.children.map((c, i) => (
              <BlockNode key={i} block={c} level={level + 1} />
            ))}
          </div>
        )}
      </div>
    );
  }

  if (block.type === "bullet") {
    return (
      <div>
        <p className="text-slate-700 whitespace-pre-line">
          <span className="text-brand">●</span> {block.text}
        </p>
        {block.children.length > 0 && (
          <div className="mt-1.5 space-y-1.5 pl-4">
            {block.children.map((c, i) => (
              <BlockNode key={i} block={c} level={level + 1} />
            ))}
          </div>
        )}
      </div>
    );
  }

  // note
  return (
    <div className="rounded border-l-2 border-amber-300 bg-amber-50 px-3 py-1.5">
      <p className="text-xs text-amber-800 whitespace-pre-line">
        <span className="font-semibold">※</span> {block.text}
      </p>
      {block.children.length > 0 && (
        <div className="mt-1.5 space-y-1.5 pl-4">
          {block.children.map((c, i) => (
            <BlockNode key={i} block={c} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
