import { customAlphabet } from "nanoid";

const nano = customAlphabet("0123456789abcdefghjkmnpqrstuvwxyz", 8);

export function makeId(): string {
  return nano();
}

export function slugify(input: string): string {
  const cleaned = input
    .normalize("NFC")
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return cleaned || nano();
}

const USERNAME_RE = /^[a-z0-9_]{3,20}$/;
export function validateUsername(u: string): boolean {
  return USERNAME_RE.test(u);
}

export function excerptFromHtml(html: string, n = 160): string {
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return text.length > n ? text.slice(0, n) + "…" : text;
}
