"use client";

import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user, profile, signOut, loading } = useAuth();
  const nav = useNavigate();

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-sky-100 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link to="/" className="text-xl font-bold tracking-tight text-slate-800">
            <span className="text-brand">📖</span> Novel Blog
          </Link>
          <nav className="flex items-center gap-2 text-sm">
            {loading ? null : user ? (
              <>
                <Link
                  to="/write"
                  className="rounded-full bg-brand px-3 py-1.5 font-medium text-white hover:bg-brand-dark"
                >
                  글쓰기
                </Link>
                {profile && (
                  <Link
                    to={`/u/${profile.username}`}
                    className="rounded-full px-3 py-1.5 text-slate-700 hover:bg-sky-50"
                  >
                    내 블로그
                  </Link>
                )}
                <Link
                  to="/dashboard"
                  className="rounded-full px-3 py-1.5 text-slate-700 hover:bg-sky-50"
                >
                  내 글
                </Link>
                <Link
                  to="/account"
                  className="rounded-full px-3 py-1.5 text-slate-700 hover:bg-sky-50"
                >
                  설정
                </Link>
                <span className="hidden px-2 text-slate-500 sm:inline">
                  {profile?.display_name ?? user.email}
                </span>
                <button
                  type="button"
                  onClick={async () => {
                    await signOut();
                    nav("/");
                  }}
                  className="rounded-full px-3 py-1.5 text-slate-600 hover:bg-sky-50"
                >
                  로그아웃
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="rounded-full px-3 py-1.5 text-slate-700 hover:bg-sky-50"
                >
                  로그인
                </Link>
                <Link
                  to="/signup"
                  className="rounded-full bg-brand px-3 py-1.5 font-medium text-white hover:bg-brand-dark"
                >
                  가입
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
      <footer className="mt-16 border-t border-sky-100 py-8 text-center text-xs text-slate-500">
        © {new Date().getFullYear()} Novel Blog
      </footer>
    </>
  );
}
