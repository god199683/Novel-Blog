"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  postCount: number;
};

export default function DeleteAccountForm({ postCount }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-100"
      >
        계정 삭제…
      </button>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (
      !window.confirm(
        `정말로 계정을 삭제할까요?\n작성한 글 ${postCount}개를 포함한 모든 데이터가 사라집니다.\n이 작업은 되돌릴 수 없습니다.`
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/auth/account", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password, confirm }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error || "삭제에 실패했습니다");
      }
      // Account is gone — go home
      router.refresh();
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다");
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-700">
          비밀번호
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
          className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm focus:border-red-400 focus:outline-none focus:ring-1 focus:ring-red-300"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-700">
          확인을 위해 <span className="font-mono font-bold text-red-600">DELETE</span>
          를 그대로 입력하세요
        </label>
        <input
          type="text"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="off"
          required
          className="w-full rounded border border-slate-300 bg-white px-3 py-2 font-mono text-sm focus:border-red-400 focus:outline-none focus:ring-1 focus:ring-red-300"
        />
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={busy || !password || confirm !== "DELETE"}
          className="rounded-full bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-40"
        >
          {busy ? "삭제 중…" : "영구 삭제"}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setPassword("");
            setConfirm("");
            setError(null);
          }}
          disabled={busy}
          className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          취소
        </button>
      </div>
    </form>
  );
}
