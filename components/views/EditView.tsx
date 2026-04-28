"use client";

import { useEffect, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { supabase, type Post } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import PostForm from "@/components/PostForm";

export default function EditView() {
  const { id } = useParams<{ id: string }>();
  const { user, loading } = useAuth();
  const [post, setPost] = useState<Post | null>(null);
  const [loadingPost, setLoadingPost] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let active = true;
    (async () => {
      const { data, error } = await supabase()
        .from("posts")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (!active) return;
      if (error) setError(error.message);
      else setPost(data as Post | null);
      setLoadingPost(false);
    })();
    return () => {
      active = false;
    };
  }, [id]);

  if (loading || loadingPost)
    return <p className="py-10 text-center text-slate-500">로딩...</p>;
  if (!user) return <Navigate to="/login" replace />;
  if (error) return <p className="py-10 text-center text-red-600">{error}</p>;
  if (!post) return <p className="py-10 text-center text-slate-500">글을 찾을 수 없어요</p>;
  if (post.author_id !== user.id) return <Navigate to="/" replace />;

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-slate-900">
        {post.kind === "material" ? "자료 수정" : "글 수정"}
      </h1>
      <PostForm
        kind={post.kind ?? "post"}
        initial={{
          id: post.id,
          title: post.title,
          content: post.content,
          category: post.category,
          folderId: post.folder_id,
          published: post.published,
          kind: post.kind ?? "post",
        }}
      />
    </div>
  );
}
