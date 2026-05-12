// 글 내보내기 공통 헬퍼 — DashboardView, UserBlogView 등에서 공유
import type { Post } from "@/lib/supabase";

export function sanitizeFilename(name: string): string {
  return (
    name
      .replace(/[\\/:*?"<>|]/g, "_")
      .replace(/\s+/g, " ")
      .trim() || "글"
  );
}

export function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// HTML 본문 → 단락 텍스트 배열 (단락 단위로 줄나눔)
export function htmlToParagraphs(html: string): string[] {
  if (!html) return [];
  const normalized = html
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\s*\/(p|div|h[1-6]|li|blockquote|pre)\s*>/gi, "\n\n")
    .replace(/<\s*li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "");
  return normalized
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .split(/\n\n+/)
    .map((s) => s.replace(/\n/g, " ").trim())
    .filter((s) => s.length > 0);
}

export function exportPostAsTxt(p: Post) {
  // 파일 이름만 제목으로 — 본문에는 제목/날짜 등 메타데이터를 넣지 않음
  const paragraphs = htmlToParagraphs(p.content);
  const text = paragraphs.join("\r\n");
  // BOM (﻿) — 메모장에서 한글 깨짐 방지
  const blob = new Blob([`﻿${text}`], {
    type: "text/plain;charset=utf-8",
  });
  triggerDownload(blob, `${sanitizeFilename(p.title || "글")}.txt`);
}

export async function exportPostAsDocx(p: Post) {
  const docx = await import("docx");
  const { Document, Packer, Paragraph, TextRun } = docx;
  // 파일 이름만 제목으로 — 본문에는 제목/날짜 등 메타데이터를 넣지 않음
  const paragraphs = htmlToParagraphs(p.content);
  const children = paragraphs.map(
    (t) => new Paragraph({ children: [new TextRun(t)] })
  );
  const doc = new Document({
    sections: [{ children }],
    creator: "Novel Blog",
    title: p.title,
  });
  const blob = await Packer.toBlob(doc);
  triggerDownload(blob, `${sanitizeFilename(p.title || "글")}.docx`);
}

export async function exportPostsAs(
  posts: Post[],
  format: "txt" | "docx"
): Promise<void> {
  for (const p of posts) {
    if (format === "txt") exportPostAsTxt(p);
    else await exportPostAsDocx(p);
    // 브라우저 동시 다운로드 차단 회피
    await new Promise((r) => setTimeout(r, 250));
  }
}
