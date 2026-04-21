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
      className="rounded-full px-3 py-1.5 text-zinc-600 hover:bg-zinc-100"
    >
      로그아웃
    </button>
  );
}
