import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Novel Blog",
  description: "소설 블로그",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css"
        />
      </head>
      <body className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-white text-slate-900">
        {children}
      </body>
    </html>
  );
}
