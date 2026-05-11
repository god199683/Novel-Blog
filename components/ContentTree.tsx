"use client";

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { Post, Folder, Category } from "@/lib/supabase";
import { buildTree, type FolderNode } from "@/lib/folders";
import PostActions from "@/components/PostActions";

type Props = {
  username: string;
  mode: "post" | "material";
  isOwner: boolean;
  posts: Post[];
  folders: Folder[];
  categories: Category[];
  selectedCategory: string | null;
  selectedFolder: string | null;
  onPostDeleted: (id: string) => void;
  onPostToggled: (id: string) => void;
  // 선택 모드 (소유자 전용 — UserBlogView에서 내보내기용)
  selectMode?: boolean;
  picked?: Set<string>;
  onTogglePick?: (id: string) => void;
};

const CATS_KEY = "nb_main_collapsed_cats";
const FOLDERS_KEY = "nb_main_collapsed_folders";

export default function ContentTree({
  username,
  mode,
  isOwner,
  posts,
  folders,
  categories,
  selectedCategory,
  selectedFolder,
  onPostDeleted,
  onPostToggled,
  selectMode = false,
  picked,
  onTogglePick,
}: Props) {
  const [collapsedCats, setCollapsedCats] = useState<Set<string>>(new Set());
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(
    new Set()
  );

  useEffect(() => {
    try {
      const c = window.localStorage.getItem(CATS_KEY);
      if (c) setCollapsedCats(new Set(JSON.parse(c) as string[]));
      const f = window.localStorage.getItem(FOLDERS_KEY);
      if (f) setCollapsedFolders(new Set(JSON.parse(f) as string[]));
    } catch {}
  }, []);

  const toggleCategory = (name: string) => {
    setCollapsedCats((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      try {
        window.localStorage.setItem(CATS_KEY, JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });
  };

  const toggleFolder = (id: string) => {
    setCollapsedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        window.localStorage.setItem(FOLDERS_KEY, JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });
  };

  const tree = useMemo(() => buildTree(folders), [folders]);

  // category 이름 → 그 카테고리의 최상위 폴더들
  const rootByCategory = useMemo(() => {
    const validCats = new Set(categories.map((c) => c.name));
    const map = new Map<string, FolderNode[]>();
    for (const c of categories) map.set(c.name, []);
    for (const node of tree) {
      if (node.category && validCats.has(node.category)) {
        map.get(node.category)!.push(node);
      }
    }
    return map;
  }, [tree, categories]);

  // folder_id → 그 폴더에 직접 속한 글들
  const postsByFolder = useMemo(() => {
    const map = new Map<string, Post[]>();
    for (const p of posts) {
      if (!p.folder_id) continue;
      const list = map.get(p.folder_id) ?? [];
      list.push(p);
      map.set(p.folder_id, list);
    }
    return map;
  }, [posts]);

  // 카테고리 이름 → 폴더 없이 그 카테고리만 가진 글들
  const postsDirectInCategory = useMemo(() => {
    const map = new Map<string, Post[]>();
    for (const p of posts) {
      if (p.folder_id) continue;
      if (!p.category) continue;
      const list = map.get(p.category) ?? [];
      list.push(p);
      map.set(p.category, list);
    }
    return map;
  }, [posts]);

  // 카테고리에 속하지 않는(또는 사라진 카테고리를 가리키는) 최상위 폴더
  const orphanRootFolders = useMemo(() => {
    const validCats = new Set(categories.map((c) => c.name));
    return tree.filter((n) => !n.category || !validCats.has(n.category));
  }, [tree, categories]);

  // 카테고리도 폴더도 없는 글
  const orphanPosts = useMemo(
    () => posts.filter((p) => !p.folder_id && !p.category),
    [posts]
  );

  // 어떤 카테고리/폴더가 보일지 결정
  const visibleCategories: Category[] = selectedCategory
    ? categories.filter((c) => c.name === selectedCategory)
    : categories;

  // 폴더 단독 필터인 경우, 그 폴더 subtree만 렌더
  if (selectedFolder) {
    const root = folders.find((f) => f.id === selectedFolder);
    if (!root) {
      return (
        <p className="py-10 text-center text-slate-500">
          폴더를 찾을 수 없어요.
        </p>
      );
    }
    const rootNode = findNode(tree, selectedFolder);
    if (!rootNode) {
      return (
        <p className="py-10 text-center text-slate-500">
          폴더를 찾을 수 없어요.
        </p>
      );
    }
    return (
      <ul className="space-y-1">
        <FolderNodeView
          node={rootNode}
          depth={0}
          username={username}
          mode={mode}
          isOwner={isOwner}
          collapsedFolders={collapsedFolders}
          toggleFolder={toggleFolder}
          postsByFolder={postsByFolder}
          onPostDeleted={onPostDeleted}
          onPostToggled={onPostToggled}
          selectMode={selectMode}
          picked={picked}
          onTogglePick={onTogglePick}
        />
      </ul>
    );
  }

  if (
    visibleCategories.length === 0 &&
    orphanPosts.length === 0 &&
    orphanRootFolders.length === 0
  ) {
    return (
      <p className="py-10 text-center text-slate-500">
        {mode === "material" ? "아직 자료가 없어요." : "아직 글이 없어요."}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {visibleCategories.map((c) => {
        const collapsed = collapsedCats.has(c.name);
        const directPosts = postsDirectInCategory.get(c.name) ?? [];
        const roots = rootByCategory.get(c.name) ?? [];
        const isEmpty = directPosts.length === 0 && roots.length === 0;
        return (
          <section key={c.id} className="rounded-lg border border-sky-100 bg-white">
            <header className="flex items-center justify-between border-b border-sky-100 px-3 py-2">
              <button
                type="button"
                onClick={() => toggleCategory(c.name)}
                className="flex flex-1 items-center gap-2 text-left"
              >
                <span
                  className="inline-block text-xs text-slate-400 transition-transform"
                  style={{
                    transform: collapsed ? "rotate(0deg)" : "rotate(90deg)",
                  }}
                >
                  ▶
                </span>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
                  {c.name}
                </h2>
              </button>
              <Link
                to={`/u/${username}${
                  mode === "material" ? "/materials" : ""
                }?category=${encodeURIComponent(c.name)}`}
                className="ml-2 text-xs text-slate-400 hover:text-brand"
              >
                필터로 보기 →
              </Link>
            </header>
            {!collapsed && (
              <div className="px-2 py-2">
                {isEmpty ? (
                  <p className="px-2 py-3 text-xs text-slate-400">비어 있음</p>
                ) : (
                  <ul className="space-y-1">
                    {/* 카테고리에 직접 속한 글(폴더 없음) */}
                    {directPosts
                      .filter((p) => isOwner || p.published)
                      .map((p) => (
                        <PostRow
                          key={p.id}
                          post={p}
                          depth={0}
                          username={username}
                          mode={mode}
                          isOwner={isOwner}
                          folders={folders}
                          onPostDeleted={onPostDeleted}
                          onPostToggled={onPostToggled}
                          selectMode={selectMode}
                          picked={picked?.has(p.id) ?? false}
                          onTogglePick={
                            onTogglePick ? () => onTogglePick(p.id) : undefined
                          }
                        />
                      ))}
                    {/* 폴더 트리 */}
                    {roots.map((node) => (
                      <FolderNodeView
                        key={node.id}
                        node={node}
                        depth={0}
                        username={username}
                        mode={mode}
                        isOwner={isOwner}
                        collapsedFolders={collapsedFolders}
                        toggleFolder={toggleFolder}
                        postsByFolder={postsByFolder}
                        onPostDeleted={onPostDeleted}
                        onPostToggled={onPostToggled}
                      />
                    ))}
                  </ul>
                )}
              </div>
            )}
          </section>
        );
      })}

      {/* 카테고리에 속하지 않은 폴더 + 카테고리·폴더 둘 다 없는 글 */}
      {!selectedCategory &&
        (orphanRootFolders.length > 0 || orphanPosts.length > 0) && (
          <section className="rounded-lg border border-dashed border-sky-200 bg-white/60">
            <header className="border-b border-sky-100 px-3 py-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                분류 없음
              </h2>
            </header>
            <ul className="space-y-1 px-2 py-2">
              {orphanPosts
                .filter((p) => isOwner || p.published)
                .map((p) => (
                  <PostRow
                    key={p.id}
                    post={p}
                    depth={0}
                    username={username}
                    mode={mode}
                    isOwner={isOwner}
                    folders={folders}
                    onPostDeleted={onPostDeleted}
                    onPostToggled={onPostToggled}
                    selectMode={selectMode}
                    picked={picked?.has(p.id) ?? false}
                    onTogglePick={
                      onTogglePick ? () => onTogglePick(p.id) : undefined
                    }
                  />
                ))}
              {orphanRootFolders.map((node) => (
                <FolderNodeView
                  key={node.id}
                  node={node}
                  depth={0}
                  username={username}
                  mode={mode}
                  isOwner={isOwner}
                  collapsedFolders={collapsedFolders}
                  toggleFolder={toggleFolder}
                  postsByFolder={postsByFolder}
                  onPostDeleted={onPostDeleted}
                  onPostToggled={onPostToggled}
                />
              ))}
            </ul>
          </section>
        )}
    </div>
  );
}

// =====================================================================
//  FolderNodeView — 폴더 한 노드 + 그 안의 글 + 자식 폴더 (재귀)
// =====================================================================

function findNode(tree: FolderNode[], id: string): FolderNode | null {
  for (const node of tree) {
    if (node.id === id) return node;
    const found = findNode(node.children, id);
    if (found) return found;
  }
  return null;
}

type FolderNodeProps = {
  node: FolderNode;
  depth: number;
  username: string;
  mode: "post" | "material";
  isOwner: boolean;
  collapsedFolders: Set<string>;
  toggleFolder: (id: string) => void;
  postsByFolder: Map<string, Post[]>;
  onPostDeleted: (id: string) => void;
  onPostToggled: (id: string) => void;
  selectMode?: boolean;
  picked?: Set<string>;
  onTogglePick?: (id: string) => void;
};

function FolderNodeView({
  node,
  depth,
  username,
  mode,
  isOwner,
  collapsedFolders,
  toggleFolder,
  postsByFolder,
  onPostDeleted,
  onPostToggled,
  selectMode,
  picked,
  onTogglePick,
}: FolderNodeProps) {
  const collapsed = collapsedFolders.has(node.id);
  const childFolders = node.children;
  const directPosts = (postsByFolder.get(node.id) ?? []).filter(
    (p) => isOwner || p.published
  );
  const hasChildren = childFolders.length > 0 || directPosts.length > 0;

  return (
    <li>
      <div
        className="flex items-center gap-1 rounded hover:bg-sky-50"
        style={{ paddingLeft: depth * 16 }}
      >
        <button
          type="button"
          onClick={() => toggleFolder(node.id)}
          className={`flex h-6 w-5 items-center justify-center text-xs text-slate-400 hover:text-slate-700 ${
            !hasChildren ? "invisible" : ""
          }`}
          aria-label={collapsed ? "펼치기" : "접기"}
        >
          <span
            className="inline-block text-[9px] transition-transform"
            style={{ transform: collapsed ? "rotate(0deg)" : "rotate(90deg)" }}
          >
            ▶
          </span>
        </button>
        <Link
          to={`/u/${username}${
            mode === "material" ? "/materials" : ""
          }?folder=${node.id}`}
          className="flex-1 truncate rounded px-1 py-1 text-sm font-medium text-slate-700 hover:text-brand"
        >
          📁 {node.name}
          {directPosts.length > 0 && (
            <span className="ml-2 text-xs font-normal text-slate-400">
              {directPosts.length}편
            </span>
          )}
        </Link>
      </div>
      {!collapsed && hasChildren && (
        <ul className="space-y-1">
          {directPosts.map((p) => (
            <PostRow
              key={p.id}
              post={p}
              depth={depth + 1}
              username={username}
              mode={mode}
              isOwner={isOwner}
              folders={[]}
              onPostDeleted={onPostDeleted}
              onPostToggled={onPostToggled}
              selectMode={selectMode}
              picked={picked?.has(p.id) ?? false}
              onTogglePick={
                onTogglePick ? () => onTogglePick(p.id) : undefined
              }
            />
          ))}
          {childFolders.map((child) => (
            <FolderNodeView
              key={child.id}
              node={child}
              depth={depth + 1}
              username={username}
              mode={mode}
              isOwner={isOwner}
              collapsedFolders={collapsedFolders}
              toggleFolder={toggleFolder}
              postsByFolder={postsByFolder}
              onPostDeleted={onPostDeleted}
              onPostToggled={onPostToggled}
              selectMode={selectMode}
              picked={picked}
              onTogglePick={onTogglePick}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

// =====================================================================
//  PostRow — 글 한 줄
// =====================================================================

type PostRowProps = {
  post: Post;
  depth: number;
  username: string;
  mode: "post" | "material";
  isOwner: boolean;
  folders: Folder[];
  onPostDeleted: (id: string) => void;
  onPostToggled: (id: string) => void;
  selectMode?: boolean;
  picked?: boolean;
  onTogglePick?: () => void;
};

function PostRow({
  post,
  depth,
  username,
  mode,
  isOwner,
  onPostDeleted,
  onPostToggled,
  selectMode = false,
  picked = false,
  onTogglePick,
}: PostRowProps) {
  return (
    <li
      className="flex items-start justify-between gap-3 rounded py-1.5 pr-2 hover:bg-sky-50/70"
      style={{ paddingLeft: depth * 16 + 28 }}
    >
      {selectMode && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onTogglePick?.();
          }}
          className="mt-1 h-5 w-5 shrink-0 rounded border flex items-center justify-center text-[11px] font-bold transition-colors"
          style={{
            background: picked ? "#0ea5e9" : "white",
            borderColor: picked ? "#0ea5e9" : "#cbd5e1",
            color: picked ? "white" : "transparent",
          }}
          title="내보내기 선택"
          aria-pressed={picked}
        >
          ✓
        </button>
      )}
      <Link
        to={
          mode === "material"
            ? `/u/${username}/materials/${post.id}`
            : `/u/${username}/${post.id}`
        }
        className="block flex-1 min-w-0 group"
      >
        <div className="flex items-center gap-2 text-xs text-slate-400">
          {!post.published && (
            <span className="rounded-full bg-amber-100 px-1.5 py-0.5 font-medium text-amber-700">
              비공개
            </span>
          )}
          <time>{post.created_at.slice(0, 10)}</time>
        </div>
        <p className="truncate text-sm font-medium text-slate-800 group-hover:text-brand">
          📄 {post.title}
        </p>
      </Link>
      {isOwner && (
        <PostActions
          postId={post.id}
          title={post.title}
          published={post.published}
          onChanged={(action) => {
            if (action === "deleted") onPostDeleted(post.id);
            else if (action === "toggled") onPostToggled(post.id);
          }}
        />
      )}
    </li>
  );
}
