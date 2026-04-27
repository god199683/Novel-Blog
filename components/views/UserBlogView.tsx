"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Link,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  supabase,
  type Profile,
  type Post,
  type Folder,
  type Category,
} from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import { descendantIds } from "@/lib/folders";
import BlogSidebar from "@/components/BlogSidebar";
import PostActions from "@/components/PostActions";

export default function UserBlogView() {
  const { username } = useParams<{ username: string }>();
  const [params] = useSearchParams();
  const selectedCategory = params.get("category");
  const selectedFolder = params.get("folder");

  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const isOwner = useMemo(
    () => !!profile && !!user && profile.id === user.id,
    [profile, user]
  );

  useEffect(() => {
    if (!username) return;
    let active = true;
    (async () => {
      setLoading(true);
      setNotFound(false);
      const sb = supabase();
      const { data: prof } = await sb
        .from("profiles")
        .select("*")
        .eq("username", username.toLowerCase())
        .maybeSingle();
      if (!active) return;
      if (!prof) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setProfile(prof as Profile);

      // 폴더/카테고리 먼저 — 폴더 클릭 시 하위 폴더 ID까지 포함해서
      // 글 쿼리를 만들기 때문에.
      const [foldersRes, catsRes] = await Promise.all([
        sb
          .from("folders")
          .select("*")
          .eq("user_id", (prof as Profile).id)
          .order("sort_order")
          .order("created_at", { ascending: false }),
        sb
          .from("categories")
          .select("*")
          .eq("user_id", (prof as Profile).id)
          .order("sort_order")
          .order("created_at", { ascending: false }),
      ]);
      if (!active) return;
      const folderRows = (foldersRes.data ?? []) as Folder[];
      setFolders(folderRows);
      setCategories((catsRes.data ?? []) as Category[]);

      let q = sb
        .from("posts")
        .select("*")
        .eq("author_id", (prof as Profile).id)
        .order("created_at", { ascending: false });
      if (selectedCategory) q = q.eq("category", selectedCategory);
      if (selectedFolder) {
        const ids = descendantIds(folderRows, selectedFolder);
        q = q.in("folder_id", ids);
      }
      const postsRes = await q;
      if (!active) return;
      setPosts((postsRes.data ?? []) as Post[]);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [username, selectedCategory, selectedFolder]);

  if (loading) return <p className="py-10 text-center text-slate-500">불러오는 중...</p>;
  if (notFound) return <p className="py-10 text-center text-slate-500">사용자를 찾을 수 없어요</p>;
  if (!profile) return null;

  const folderName = selectedFolder
    ? folders.find((f) => f.id === selectedFolder)?.name
    : null;

  return (
    <div>
      <section className="mb-8 rounded-2xl bg-gradient-to-br from-sky-50 to-white p-8 ring-1 ring-sky-100">
        <h1 className="text-3xl font-bold text-slate-900">
          {profile.blog_title ?? `${profile.display_name}의 블로그`}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          @{profile.username} · {profile.display_name}
        </p>
        {profile.bio && <p className="mt-3 text-slate-700">{profile.bio}</p>}
      </section>

      <div className="grid gap-8 md:grid-cols-[200px_1fr]">
        <BlogSidebar
          username={profile.username}
          isOwner={isOwner}
          initialCategories={categories}
          initialFolders={folders}
          selectedCategory={selectedCategory}
          selectedFolder={selectedFolder}
          onChange={(updates) => {
            if (updates.categories) setCategories(updates.categories);
            if (updates.folders) setFolders(updates.folders);
          }}
        />

        <div>
          {(selectedCategory || folderName) && (
            <p className="mb-4 text-sm text-slate-500">
              {selectedCategory && (
                <span className="mr-2">
                  카테고리:{" "}
                  <strong className="text-slate-700">{selectedCategory}</strong>
                </span>
              )}
              {folderName && (
                <span>
                  폴더:{" "}
                  <strong className="text-slate-700">📁 {folderName}</strong>
                </span>
              )}
            </p>
          )}
          {selectedCategory && !selectedFolder ? (
            (() => {
              const topLevel = folders.filter(
                (f) => !f.parent_id && f.category === selectedCategory
              );
              if (topLevel.length === 0) {
                return (
                  <p className="py-10 text-center text-slate-500">
                    이 카테고리에 폴더가 없어요.
                  </p>
                );
              }
              return (
                <ul className="grid gap-3 sm:grid-cols-2">
                  {topLevel.map((f) => {
                    const childCount = folders.filter(
                      (x) => x.parent_id === f.id
                    ).length;
                    return (
                      <li key={f.id}>
                        <Link
                          to={`/u/${profile.username}?folder=${f.id}`}
                          className="block rounded-xl border border-sky-100 bg-white p-5 shadow-sm transition hover:border-brand hover:shadow-md"
                        >
                          <div className="text-2xl">📁</div>
                          <div className="mt-2 font-semibold text-slate-900">
                            {f.name}
                          </div>
                          {childCount > 0 && (
                            <div className="mt-1 text-xs text-slate-500">
                              하위 폴더 {childCount}개
                            </div>
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              );
            })()
          ) : posts.length === 0 ? (
            <p className="py-10 text-center text-slate-500">아직 글이 없어요.</p>
          ) : (
            <ul className="divide-y divide-sky-100">
              {posts
                .filter((p) => isOwner || p.published)
                .map((p) => {
                  const folder = p.folder_id
                    ? folders.find((f) => f.id === p.folder_id)
                    : null;
                  return (
                    <li
                      key={p.id}
                      className="flex items-start justify-between gap-4 py-5"
                    >
                      <Link
                        to={`/u/${profile.username}/${p.id}`}
                        className="block flex-1 group"
                      >
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          {!p.published && (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-700">
                              비공개
                            </span>
                          )}
                          {p.category && (
                            <span className="rounded-full bg-brand-light px-2 py-0.5 text-brand-dark">
                              {p.category}
                            </span>
                          )}
                          {folder && (
                            <span className="rounded-full bg-sky-50 px-2 py-0.5 text-slate-600 ring-1 ring-sky-200">
                              📁 {folder.name}
                            </span>
                          )}
                          <time>{p.created_at.slice(0, 10)}</time>
                        </div>
                        <h2 className="mt-1 text-xl font-bold text-slate-900 group-hover:text-brand">
                          {p.title}
                        </h2>
                        {p.excerpt && (
                          <p className="mt-1 line-clamp-2 text-sm text-slate-600">
                            {p.excerpt}
                          </p>
                        )}
                      </Link>
                      {isOwner && (
                        <PostActions
                          postId={p.id}
                          title={p.title}
                          published={p.published}
                          onChanged={(action) => {
                            if (action === "deleted") {
                              setPosts((ps) => ps.filter((x) => x.id !== p.id));
                            } else if (action === "toggled") {
                              setPosts((ps) =>
                                ps.map((x) =>
                                  x.id === p.id
                                    ? { ...x, published: !x.published }
                                    : x
                                )
                              );
                            }
                          }}
                        />
                      )}
                    </li>
                  );
                })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
