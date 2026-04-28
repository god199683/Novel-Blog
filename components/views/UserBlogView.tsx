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
import ContentTree from "@/components/ContentTree";

type Props = { mode?: "post" | "material" };

export default function UserBlogView({ mode = "post" }: Props) {
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
      // 글 쿼리를 만들기 때문에. mode(글/자료)에 맞는 것만.
      const [foldersRes, catsRes] = await Promise.all([
        sb
          .from("folders")
          .select("*")
          .eq("user_id", (prof as Profile).id)
          .eq("kind", mode)
          .order("sort_order")
          .order("created_at", { ascending: false }),
        sb
          .from("categories")
          .select("*")
          .eq("user_id", (prof as Profile).id)
          .eq("kind", mode)
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
        .eq("kind", mode)
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
  }, [username, selectedCategory, selectedFolder, mode]);

  if (loading) return <p className="py-10 text-center text-slate-500">불러오는 중...</p>;
  if (notFound) return <p className="py-10 text-center text-slate-500">사용자를 찾을 수 없어요</p>;
  if (!profile) return null;

  const folderName = selectedFolder
    ? folders.find((f) => f.id === selectedFolder)?.name
    : null;

  const blogPath = `/u/${profile.username}`;
  const materialsPath = `/u/${profile.username}/materials`;

  return (
    <div>
      <section className="mb-6 rounded-2xl bg-gradient-to-br from-sky-50 to-white p-8 ring-1 ring-sky-100">
        <h1 className="text-3xl font-bold text-slate-900">
          {profile.blog_title ?? `${profile.display_name}의 블로그`}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          @{profile.username} · {profile.display_name}
        </p>
        {profile.bio && <p className="mt-3 text-slate-700">{profile.bio}</p>}
      </section>

      <nav className="mb-6 flex items-center justify-between border-b border-sky-100">
        <div className="flex gap-1">
          <Link
            to={blogPath}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${
              mode === "post"
                ? "border-brand text-brand"
                : "border-transparent text-slate-500 hover:text-brand"
            }`}
          >
            글
          </Link>
          <Link
            to={materialsPath}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${
              mode === "material"
                ? "border-brand text-brand"
                : "border-transparent text-slate-500 hover:text-brand"
            }`}
          >
            자료실
          </Link>
        </div>
        {isOwner && (
          <Link
            to={mode === "material" ? "/write?kind=material" : "/write"}
            className="my-2 rounded-full border border-sky-200 px-3 py-1 text-xs text-slate-700 hover:border-brand hover:text-brand"
          >
            + 새 {mode === "material" ? "자료" : "글"}
          </Link>
        )}
      </nav>

      <div className="grid gap-8 md:grid-cols-[200px_1fr]">
        <BlogSidebar
          username={profile.username}
          isOwner={isOwner}
          mode={mode}
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
          <ContentTree
            username={profile.username}
            mode={mode}
            isOwner={isOwner}
            posts={posts}
            folders={folders}
            categories={categories}
            selectedCategory={selectedCategory}
            selectedFolder={selectedFolder}
            onPostDeleted={(id) =>
              setPosts((ps) => ps.filter((x) => x.id !== id))
            }
            onPostToggled={(id) =>
              setPosts((ps) =>
                ps.map((x) => (x.id === id ? { ...x, published: !x.published } : x))
              )
            }
          />
        </div>
      </div>
    </div>
  );
}
