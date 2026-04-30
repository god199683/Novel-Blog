"use client";

import { Link, useLocation } from "react-router-dom";
import type { Space, Profile } from "@/lib/supabase";

const NAV: { suffix: string; label: string; icon: string }[] = [
  { suffix: "", label: "대시보드", icon: "🏠" },
  { suffix: "/map", label: "정원 맵", icon: "🌍" },
  { suffix: "/zones", label: "구역 관리", icon: "🗺️" },
  { suffix: "/creatures", label: "동식물 관리", icon: "🌱" },
  { suffix: "/byproducts", label: "부산물/채집품", icon: "💎" },
  { suffix: "/settings", label: "시스템 설정", icon: "⚙️" },
  { suffix: "/access", label: "출입 관리", icon: "🔑" },
];

type Props = {
  space: Space;
  base: string; // "/spaces/<id>" or "/u/<user>/spaces/<slug>"
  profile?: Profile | null;
  isOwner: boolean;
  children: React.ReactNode;
};

export default function SpaceShell({
  space,
  base,
  profile,
  isOwner,
  children,
}: Props) {
  const location = useLocation();
  const here = location.pathname;

  return (
    <div className="space-app flex min-h-screen overflow-hidden">
      <aside
        className="flex w-64 flex-col border-r"
        style={{
          background: "var(--space-card)",
          borderColor: "var(--space-border)",
        }}
      >
        <header
          className="border-b p-6"
          style={{ borderColor: "var(--space-border)" }}
        >
          <h1
            className="text-xl font-bold flex items-center gap-2"
            style={{ color: "var(--space-accent)" }}
          >
            <span>{space.icon}</span>
            <span className="truncate">{space.title}</span>
          </h1>
          {space.description && (
            <p
              className="text-sm mt-1"
              style={{ color: "var(--space-fg-muted)" }}
            >
              {space.description}
            </p>
          )}
        </header>

        <nav className="flex-1 p-4 space-y-1 overflow-auto">
          {NAV.map((item) => {
            const target = `${base}${item.suffix}`;
            const isActive =
              here === target ||
              (item.suffix === "" && here === base + "/");
            return (
              <Link
                key={item.suffix}
                to={target}
                className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm transition-colors"
                style={
                  isActive
                    ? {
                        background: "var(--space-accent-soft)",
                        color: "var(--space-accent)",
                        fontWeight: 600,
                      }
                    : { color: "var(--space-fg-muted)" }
                }
                onMouseEnter={(e) => {
                  if (!isActive) {
                    (e.currentTarget as HTMLElement).style.background =
                      "var(--space-card-hover)";
                    (e.currentTarget as HTMLElement).style.color =
                      "var(--space-fg)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    (e.currentTarget as HTMLElement).style.background =
                      "transparent";
                    (e.currentTarget as HTMLElement).style.color =
                      "var(--space-fg-muted)";
                  }
                }}
              >
                <span className="text-lg">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <footer
          className="p-4 border-t space-y-2"
          style={{ borderColor: "var(--space-border)" }}
        >
          <div
            className="flex items-center gap-2 text-xs"
            style={{ color: "var(--space-fg-soft)" }}
          >
            <span
              className="pulse-glow w-2 h-2 rounded-full"
              style={{ background: "var(--space-accent)" }}
            />
            시스템 활성 중
          </div>
          {isOwner && profile && (
            <a
              href={`#/u/${profile.username}/spaces/${space.slug}`}
              className="block text-xs hover:opacity-80"
              style={{ color: "var(--space-fg-muted)" }}
              target="_blank"
              rel="noreferrer"
            >
              ↗ 공개 페이지
            </a>
          )}
          {profile && (
            <Link
              to={`/u/${profile.username}`}
              className="block text-xs hover:opacity-80"
              style={{ color: "var(--space-fg-muted)" }}
            >
              ← @{profile.username}의 블로그
            </Link>
          )}
          {isOwner && (
            <Link
              to="/spaces"
              className="block text-xs hover:opacity-80"
              style={{ color: "var(--space-fg-muted)" }}
            >
              ← 공간 목록
            </Link>
          )}
        </footer>
      </aside>

      <main className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto p-6">{children}</div>
      </main>
    </div>
  );
}
