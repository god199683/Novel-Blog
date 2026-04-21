import { customAlphabet } from "nanoid";

const nano = customAlphabet("0123456789abcdefghjkmnpqrstuvwxyz", 8);

export function makeId(): string {
  return nano();
}

export function slugify(input: string): string {
  const cleaned = input
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);
  return cleaned || nano();
}

export function withSuffix(slug: string): string {
  return `${slug}-${nano().slice(0, 5)}`;
}

const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

export function validateUsername(u: string): boolean {
  return USERNAME_RE.test(u);
}
