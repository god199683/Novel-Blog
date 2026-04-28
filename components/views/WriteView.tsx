"use client";

import { Navigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import PostForm from "@/components/PostForm";

export default function WriteView() {
  const { user, loading } = useAuth();
  const [params] = useSearchParams();
  const kind: "post" | "material" =
    params.get("kind") === "material" ? "material" : "post";

  if (loading) return <p className="py-10 text-center text-slate-500">로딩...</p>;
  if (!user) return <Navigate to="/login" replace />;

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-slate-900">
        {kind === "material" ? "새 자료 작성" : "새 글 쓰기"}
      </h1>
      <PostForm kind={kind} />
    </div>
  );
}
