"use client";

import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";

export default function AccountView() {
  const { user, profile, loading, signOut } = useAuth();
  const nav = useNavigate();
  const [postCount, setPostCount] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState("");

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { count } = await supabase()
        .from("posts")
        .select("id", { count: "exact", head: true })
        .eq("author_id", user.id);
      setPostCount(count ?? 0);
    })();
  }, [user]);

  if (loading) return <p className="py-10 text-center text-slate-500">로딩...</p>;
  if (!user) return <Navigate to="/login" replace />;

  const remove = async () => {
    if (confirmText !== "DELETE") {
      setError("확인 문구가 일치하지 않습니다");
      return;
    }
    if (
      !window.confirm(
        `정말 계정을 삭제할까요? 작성한 글 ${postCount ?? 0}개가 모두 사라집니다.`
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    const sb = supabase();

    // RLS는 Edge Function이 없으면 auth.users 자체를 클라에서 못 지움.
    // 차선책: 본인 데이터(profiles)를 지우면 cascade로 글/폴더/카테고리/폰트가 다 따라 사라짐.
    // 그 후 로그아웃 (auth.users 행은 남지만 사용자에게는 더 이상 데이터 없음).
    const { error: delErr } = await sb
      .from("profiles")
      .delete()
      .eq("id", user.id);
    if (delErr) {
      setBusy(false);
      setError(delErr.message);
      return;
    }
    await signOut();
    nav("/");
  };

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="mb-6 text-2xl font-bold text-slate-900">계정 설정</h1>

      <section className="mb-6 rounded-lg border border-sky-100 bg-white/70 p-5">
        <h2 className="mb-2 text-sm font-semibold text-slate-700">계정 정보</h2>
        <dl className="space-y-1 text-sm text-slate-600">
          {profile && (
            <>
              <div className="flex gap-2">
                <dt className="w-24 text-slate-400">필명</dt>
                <dd>{profile.display_name}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-24 text-slate-400">아이디</dt>
                <dd>@{profile.username}</dd>
              </div>
            </>
          )}
          <div className="flex gap-2">
            <dt className="w-24 text-slate-400">작성한 글</dt>
            <dd>{postCount ?? "..."}개</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-lg border border-red-200 bg-red-50/50 p-5">
        <h2 className="mb-1 text-sm font-semibold text-red-700">위험 구역</h2>
        <p className="mb-4 text-xs text-red-600/80">
          내 데이터(글 {postCount ?? 0}개, 폴더, 카테고리, 폰트)를 영구
          삭제합니다. 되돌릴 수 없습니다.
        </p>
        <div className="space-y-2">
          <label className="block text-xs font-medium text-slate-700">
            확인을 위해{" "}
            <span className="font-mono font-bold text-red-600">DELETE</span>를
            입력하세요
          </label>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            className="w-full rounded border border-slate-300 bg-white px-3 py-2 font-mono text-sm focus:border-red-400 focus:outline-none focus:ring-1 focus:ring-red-300"
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <button
            type="button"
            onClick={remove}
            disabled={busy || confirmText !== "DELETE"}
            className="rounded-full bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-40"
          >
            {busy ? "삭제 중..." : "내 데이터 영구 삭제"}
          </button>
        </div>
      </section>
    </div>
  );
}
