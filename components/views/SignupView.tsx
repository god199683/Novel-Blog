"use client";

import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase, usernameToEmail } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import { validateUsername } from "@/lib/slug";

export default function SignupView() {
  const nav = useNavigate();
  const { user, refreshProfile } = useAuth();
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (user) {
    nav("/dashboard", { replace: true });
    return null;
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const u = username.toLowerCase().trim();
    if (!validateUsername(u)) {
      setError("아이디는 영문 소문자/숫자/언더스코어 3-20자");
      return;
    }
    if (displayName.trim().length < 1 || displayName.trim().length > 40) {
      setError("필명은 1-40자");
      return;
    }
    if (password.length < 8) {
      setError("비밀번호는 8자 이상");
      return;
    }

    setBusy(true);
    const sb = supabase();

    // 가입 전 username 중복 사전 체크 — auth.users 고아 행을 줄이기 위해
    const { data: existing } = await sb
      .from("profiles")
      .select("id")
      .eq("username", u)
      .maybeSingle();
    if (existing) {
      setBusy(false);
      setError("이미 사용 중인 아이디예요");
      return;
    }

    // 1. Supabase Auth 가입 (합성 이메일)
    const email = usernameToEmail(u);
    const { data, error: signErr } = await sb.auth.signUp({ email, password });
    if (signErr || !data.user) {
      setBusy(false);
      // 같은 username으로 이전에 시도해서 auth.users만 남은 케이스
      if (signErr?.message?.toLowerCase().includes("already registered")) {
        setError(
          "이 아이디는 예전에 가입 시도된 적이 있어요. 다른 아이디로 시도해주세요."
        );
      } else {
        setError(signErr?.message ?? "가입 실패");
      }
      return;
    }

    // 2. profile 생성 — session이 없으면(이메일 확인 ON) RLS가 막음.
    if (!data.session) {
      setBusy(false);
      setError(
        "Supabase 설정에서 'Confirm email'을 끄거나, 메일함의 확인 링크를 눌러 주세요."
      );
      return;
    }

    const { error: profErr } = await sb.from("profiles").insert({
      id: data.user.id,
      username: u,
      display_name: displayName.trim(),
      blog_title: `${displayName.trim()}의 블로그`,
    });
    if (profErr) {
      setBusy(false);
      setError(
        profErr.code === "23505"
          ? "이미 사용 중인 아이디예요"
          : profErr.message
      );
      return;
    }

    // 3. 기본 카테고리
    const defaults = ["장편", "단편", "에세이", "기타"];
    await sb.from("categories").insert(
      defaults.map((name, i) => ({
        user_id: data.user!.id,
        name,
        sort_order: i,
      }))
    );

    await refreshProfile();
    setBusy(false);
    nav("/dashboard");
  };

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="mb-6 text-center text-2xl font-bold text-slate-900">가입</h1>
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">
            아이디 (영문 소문자/숫자/언더스코어, 3-20자) — 블로그 URL에 쓰입니다
          </label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            minLength={3}
            maxLength={20}
            autoComplete="username"
            className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">
            필명 (작가 이름)
          </label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
            maxLength={40}
            className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">
            비밀번호 (8자 이상)
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
            className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
          />
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-full bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50"
        >
          {busy ? "가입 중..." : "가입하기"}
        </button>
      </form>
      <p className="mt-4 text-center text-xs text-slate-500">
        이미 계정이 있으신가요?{" "}
        <Link to="/login" className="text-brand hover:underline">
          로그인
        </Link>
      </p>
    </div>
  );
}
