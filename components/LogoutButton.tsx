"use client";

import { useRouter } from "next/navigation";

export default function LogoutButton() {
  const router = useRouter();
  return (
    <button
      onClick={async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        router.refresh();
        router.push("/");
      }}
      className="rounded-full px-3 py-1.5 text-slate-600 hover:bg-sky-50"
    >
      로그아웃
    </button>
  );
}
