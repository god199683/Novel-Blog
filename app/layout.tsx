import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import "./globals.css";
import { verifySession } from "@/lib/auth";
import LogoutButton from "@/components/LogoutButton";

export const metadata: Metadata = {
  title: "Novel Blog",
  description: "소설 블로그",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const session = await verifySession(cookieStore.get("session")?.value);

  return (
    <html lang="ko">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css"
        />
      </head>
      <body className="min-h-screen bg-white text-zinc-900">
        <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/90 backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
            <Link href="/" className="text-xl font-bold tracking-tight">
              📖 Novel Blog
            </Link>
            <nav className="flex items-center gap-2 text-sm">
              {session ? (
                <>
                  <Link
                    href="/write"
                    className="rounded-full bg-brand px-3 py-1.5 font-medium text-white hover:bg-brand-dark"
                  >
                    글쓰기
                  </Link>
                  <Link
                    href="/dashboard"
                    className="rounded-full px-3 py-1.5 text-zinc-700 hover:bg-zinc-100"
                  >
                    내 글
                  </Link>
                  <span className="px-2 text-zinc-500">
                    {session.displayName}
                  </span>
                  <LogoutButton />
                </>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="rounded-full px-3 py-1.5 text-zinc-700 hover:bg-zinc-100"
                  >
                    로그인
                  </Link>
                  <Link
                    href="/signup"
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
        <footer className="mt-16 border-t border-zinc-200 py-8 text-center text-xs text-zinc-500">
          © {new Date().getFullYear()} Novel Blog
        </footer>
      </body>
    </html>
  );
}
