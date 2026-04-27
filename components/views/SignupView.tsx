"use client";

import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import { validateUsername } from "@/lib/slug";

export default function SignupView() {
  const nav = useNavigate();
  const { user, refreshProfile } = useAuth();
  const [email, setEmail] = useState("");
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

    // 1. 가입
    const { data, error: signErr } = await sb.auth.signUp({
      email: email.trim(),
      password,
    });
    if (signErr || !data.user) {
      setBusy(false);
      setError(signErr?.message ?? "가입 실패");
      return;
    }

    // 2. profile 생성 (auth.uid()로 RLS insert 통과)
    //    이메일 확인 OFF인 경우 session이 바로 생기지만, ON인 경우 session이 없을 수 있음.
    //    session이 없으면 profile insert가 RLS에 막히므로, 이메일 확인을 끄거나 사용자 안내 필요.
    if (data.session) {
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

      // 3. 기본 카테고리 4개
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
    } else {
      // 이메일 확인이 켜진 경우
      setBusy(false);
      setError(
        "가입 메일을 보냈어요. 메일함에서 확인 링크를 누른 뒤 다시 로그인해 주세요."
      );
    }
  };

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="mb-6 text-center text-2xl font-bold text-slate-900">
        가입
      </h1>
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">
            이메일
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">
            아이디 (영문/숫자/_) — 블로그 URL에 쓰입니다
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
