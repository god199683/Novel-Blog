"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function SignupPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, displayName, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "가입 실패");
      router.push(`/u/${data.username}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="mx-auto max-w-sm space-y-4 py-10">
      <h1 className="text-2xl font-bold text-slate-900">회원가입</h1>
      <div>
        <label className="mb-1 block text-sm text-slate-600">아이디 (URL에 사용)</label>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value.toLowerCase())}
          placeholder="영문 소문자/숫자 3-20자"
          className="w-full rounded border border-sky-200 px-3 py-2 outline-none focus:border-brand"
          autoFocus
        />
        {username && (
          <p className="mt-1 text-xs text-slate-400">
            블로그 주소: /u/{username}
          </p>
        )}
      </div>
      <div>
        <label className="mb-1 block text-sm text-slate-600">필명</label>
        <input
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="독자에게 보이는 이름"
          className="w-full rounded border border-sky-200 px-3 py-2 outline-none focus:border-brand"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm text-slate-600">비밀번호</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="8자 이상"
          className="w-full rounded border border-sky-200 px-3 py-2 outline-none focus:border-brand"
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-full bg-brand py-2.5 font-medium text-white hover:bg-brand-dark disabled:opacity-50"
      >
        {loading ? "가입 중..." : "가입하고 글쓰기"}
      </button>
      <p className="text-center text-sm text-slate-500">
        이미 계정이 있나요?{" "}
        <Link href="/login" className="text-brand hover:underline">
          로그인
        </Link>
      </p>
    </form>
  );
}
