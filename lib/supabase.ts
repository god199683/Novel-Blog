"use client";

import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Public anon key — safe to ship in the client bundle. RLS protects data.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

let _client: SupabaseClient | null = null;

export function supabase(): SupabaseClient {
  if (_client) return _client;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    // Build-time check: throw so the misconfiguration is obvious.
    throw new Error(
      "Supabase env vars missing — set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
  }
  _client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      // We are entirely client-side; no SSR cookie sync needed.
      storageKey: "nb-auth",
    },
  });
  return _client;
}

// Supabase Auth requires an email per account, but the user-facing
// flow is username-only. Map a username to a stable synthetic email
// in a non-routable namespace; users never see it.
const SYNTHETIC_EMAIL_DOMAIN = "novel-blog.local";
export function usernameToEmail(username: string): string {
  return `${username.toLowerCase().trim()}@${SYNTHETIC_EMAIL_DOMAIN}`;
}

export type Profile = {
  id: string;
  username: string;
  display_name: string;
  bio: string | null;
  blog_title: string | null;
  created_at: string;
};

export type Post = {
  id: string;
  author_id: string;
  slug: string;
  title: string;
  content: string;
  excerpt: string | null;
  category: string | null;
  folder_id: string | null;
  published: boolean;
  kind: "post" | "material";
  created_at: string;
  updated_at: string;
};

export type Folder = {
  id: string;
  user_id: string;
  name: string;
  category: string | null;
  parent_id: string | null;
  kind: "post" | "material";
  sort_order: number;
  created_at: string;
};

export type Category = {
  id: string;
  user_id: string;
  name: string;
  kind: "post" | "material";
  sort_order: number;
  created_at: string;
};

export type UserFont = {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
};

export type MapPin = {
  id: string;
  x: number;
  y: number;
  name: string;
  color: string;
  description?: string;
};

export type MapRect = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
  color: string;
};

export type MapLine = {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  thickness: number;
};

export type MapData = {
  pins: MapPin[];
  rects: MapRect[];
  lines: MapLine[];
};

export type NovelMap = {
  id: string;
  author_id: string;
  title: string;
  data: MapData;
  width: number;
  height: number;
  background_color: string;
  published: boolean;
  created_at: string;
  updated_at: string;
};
