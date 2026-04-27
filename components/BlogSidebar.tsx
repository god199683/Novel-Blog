"use client";

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase, type Category, type Folder } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import { buildTree, type FolderNode } from "@/lib/folders";

type Props = {
  username: string;
  isOwner: boolean;
  initialCategories: Category[];
  initialFolders: Folder[];
  selectedCategory: string | null;
  selectedFolder: string | null;
  onChange: (updates: { categories?: Category[]; folders?: Folder[] }) => void;
};

// "+" 버튼이 어디에 새 폴더를 넣고 싶은지 추적
type AddTarget =
  | { kind: "category"; category: string | null } // 카테고리(또는 분류 없음) 바로 밑 최상위 폴더
  | { kind: "folder"; parentId: string; category: string | null };

export default function BlogSidebar({
  username,
  isOwner,
  initialCategories,
  initialFolders,
  selectedCategory,
  selectedFolder,
  onChange,
}: Props) {
  const { user } = useAuth();
  const [cats, setCats] = useState(initialCategories);
  const [fls, setFls] = useState(initialFolders);
  const [newCat, setNewCat] = useState("");
  const [addTarget, setAddTarget] = useState<AddTarget | null>(null);
  const [newFolderName, setNewFolderName] = useState("");

  // 부모로부터 새 데이터 들어올 때 동기화
  useEffect(() => setCats(initialCategories), [initialCategories]);
  useEffect(() => setFls(initialFolders), [initialFolders]);

  const tree = useMemo(() => buildTree(fls), [fls]);

  // 최상위 폴더를 카테고리별로 묶음. 카테고리 이름이 사라졌거나 없으면 "분류 없음" 그룹.
  const rootByCategory = useMemo(() => {
    const validCats = new Set(cats.map((c) => c.name));
    const map = new Map<string | null, FolderNode[]>();
    for (const c of cats) map.set(c.name, []);
    map.set(null, []);
    for (const node of tree) {
      const key =
        node.category && validCats.has(node.category) ? node.category : null;
      map.get(key)!.push(node);
    }
    return map;
  }, [tree, cats]);

  const hasUnclassified = (rootByCategory.get(null) ?? []).length > 0;

  // -------- 카테고리 CRUD --------
  const addCategory = async () => {
    const name = newCat.trim();
    if (!name || !user) return;
    const { data, error } = await supabase()
      .from("categories")
      .insert({ user_id: user.id, name, sort_order: cats.length })
      .select()
      .single();
    if (error) {
      alert(error.message);
      return;
    }
    const updated = [...cats, data as Category];
    setCats(updated);
    setNewCat("");
    onChange({ categories: updated });
  };

  const deleteCategory = async (id: string, name: string) => {
    if (
      !confirm(
        `'${name}' 카테고리를 삭제할까요? (이 카테고리의 폴더는 '분류 없음'으로 옮겨집니다)`
      )
    )
      return;
    const { error } = await supabase().from("categories").delete().eq("id", id);
    if (error) {
      alert(error.message);
      return;
    }
    const updatedCats = cats.filter((c) => c.id !== id);
    setCats(updatedCats);
    onChange({ categories: updatedCats });
  };

  // -------- 폴더 CRUD --------
  const beginAdd = (target: AddTarget) => {
    setAddTarget(target);
    setNewFolderName("");
  };

  const addFolder = async () => {
    const name = newFolderName.trim();
    if (!name || !user || !addTarget) return;
    const payload: {
      user_id: string;
      name: string;
      sort_order: number;
      category: string | null;
      parent_id: string | null;
    } = {
      user_id: user.id,
      name,
      sort_order: fls.length,
      category: addTarget.category,
      parent_id: addTarget.kind === "folder" ? addTarget.parentId : null,
    };
    const { data, error } = await supabase()
      .from("folders")
      .insert(payload)
      .select()
      .single();
    if (error) {
      alert(error.message);
      return;
    }
    const updated = [...fls, data as Folder];
    setFls(updated);
    setAddTarget(null);
    setNewFolderName("");
    onChange({ folders: updated });
  };

  const deleteFolder = async (id: string, name: string) => {
    if (
      !confirm(
        `'${name}' 폴더를 삭제할까요? (하위 폴더는 한 단계 위로 올라오고, 글은 폴더 없음으로 이동합니다)`
      )
    )
      return;
    const { error } = await supabase().from("folders").delete().eq("id", id);
    if (error) {
      alert(error.message);
      return;
    }
    const updated = fls
      .filter((f) => f.id !== id)
      .map((f) => (f.parent_id === id ? { ...f, parent_id: null } : f));
    setFls(updated);
    onChange({ folders: updated });
  };

  return (
    <aside className="space-y-4 text-sm">
      <div>
        <Link
          to={`/u/${username}`}
          className={`block rounded px-2 py-1 ${
            !selectedCategory && !selectedFolder
              ? "bg-brand-light font-medium text-brand-dark"
              : "text-slate-700 hover:bg-sky-50"
          }`}
        >
          전체 글
        </Link>
      </div>

      <div className="space-y-3">
        {cats.map((c) => (
          <CategorySection
            key={c.id}
            categoryName={c.name}
            categoryId={c.id}
            username={username}
            isOwner={isOwner}
            roots={rootByCategory.get(c.name) ?? []}
            selectedCategory={selectedCategory}
            selectedFolder={selectedFolder}
            allFolders={fls}
            addTarget={addTarget}
            newFolderName={newFolderName}
            setNewFolderName={setNewFolderName}
            onBeginAdd={beginAdd}
            onCancelAdd={() => setAddTarget(null)}
            onAddFolder={addFolder}
            onDeleteCategory={() => deleteCategory(c.id, c.name)}
            onDeleteFolder={deleteFolder}
          />
        ))}

        {(hasUnclassified || isOwner) && (
          <CategorySection
            categoryName={null}
            categoryId={null}
            username={username}
            isOwner={isOwner}
            roots={rootByCategory.get(null) ?? []}
            selectedCategory={selectedCategory}
            selectedFolder={selectedFolder}
            allFolders={fls}
            addTarget={addTarget}
            newFolderName={newFolderName}
            setNewFolderName={setNewFolderName}
            onBeginAdd={beginAdd}
            onCancelAdd={() => setAddTarget(null)}
            onAddFolder={addFolder}
            onDeleteFolder={deleteFolder}
          />
        )}
      </div>

      {isOwner && (
        <div className="border-t border-sky-100 pt-3">
          <div className="flex items-center gap-1">
            <input
              type="text"
              value={newCat}
              onChange={(e) => setNewCat(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addCategory();
                }
              }}
              placeholder="새 카테고리"
              maxLength={30}
              className="w-full rounded border border-sky-200 bg-white px-2 py-1 text-xs text-slate-700 focus:border-brand focus:outline-none"
            />
            <button
              type="button"
              onClick={addCategory}
              className="rounded border border-sky-200 px-2 py-1 text-xs text-slate-600 hover:border-brand hover:text-brand"
            >
              +
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}

// =====================================================================
//  하위 컴포넌트
// =====================================================================

type SectionProps = {
  categoryName: string | null;
  categoryId: string | null;
  username: string;
  isOwner: boolean;
  roots: FolderNode[];
  selectedCategory: string | null;
  selectedFolder: string | null;
  allFolders: Folder[];
  addTarget: AddTarget | null;
  newFolderName: string;
  setNewFolderName: (v: string) => void;
  onBeginAdd: (t: AddTarget) => void;
  onCancelAdd: () => void;
  onAddFolder: () => void;
  onDeleteCategory?: () => void;
  onDeleteFolder: (id: string, name: string) => void;
};

function CategorySection(props: SectionProps) {
  const {
    categoryName,
    username,
    isOwner,
    roots,
    selectedCategory,
    addTarget,
    onBeginAdd,
  } = props;

  const isAddingHere =
    addTarget?.kind === "category" && addTarget.category === categoryName;

  return (
    <div>
      <div className="group flex items-center justify-between">
        {categoryName ? (
          <Link
            to={`/u/${username}?category=${encodeURIComponent(categoryName)}`}
            className={`flex-1 truncate rounded px-2 py-1 text-xs font-semibold uppercase tracking-wide ${
              selectedCategory === categoryName
                ? "bg-brand-light text-brand-dark"
                : "text-slate-500 hover:bg-sky-50"
            }`}
          >
            {categoryName}
          </Link>
        ) : (
          <span className="flex-1 truncate px-2 py-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
            분류 없음
          </span>
        )}
        {isOwner && (
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() =>
                onBeginAdd({ kind: "category", category: categoryName })
              }
              title="이 분류에 폴더 추가"
              className="rounded px-1 text-xs text-slate-400 hover:text-brand"
            >
              +
            </button>
            {categoryName && props.onDeleteCategory && (
              <button
                type="button"
                onClick={props.onDeleteCategory}
                title="카테고리 삭제"
                className="hidden rounded px-1 text-xs text-slate-400 hover:text-red-500 group-hover:block"
              >
                ✕
              </button>
            )}
          </div>
        )}
      </div>

      {isAddingHere && <AddFolderInput {...props} />}

      <ul className="mt-1 space-y-0.5">
        {roots.map((node) => (
          <FolderTreeItem key={node.id} node={node} depth={0} {...props} />
        ))}
      </ul>
    </div>
  );
}

function FolderTreeItem({
  node,
  depth,
  ...rest
}: SectionProps & { node: FolderNode; depth: number }) {
  const {
    username,
    isOwner,
    selectedFolder,
    addTarget,
    onBeginAdd,
    onDeleteFolder,
  } = rest;

  const isAddingHere =
    addTarget?.kind === "folder" && addTarget.parentId === node.id;

  return (
    <li>
      <div className="group flex items-center justify-between">
        <Link
          to={`/u/${username}?folder=${node.id}`}
          style={{ paddingLeft: 8 + depth * 14 }}
          className={`flex-1 truncate rounded py-1 ${
            selectedFolder === node.id
              ? "bg-brand-light font-medium text-brand-dark"
              : "text-slate-600 hover:bg-sky-50"
          }`}
        >
          📁 {node.name}
        </Link>
        {isOwner && (
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() =>
                onBeginAdd({
                  kind: "folder",
                  parentId: node.id,
                  category: node.category,
                })
              }
              title="하위 폴더 추가"
              className="hidden rounded px-1 text-xs text-slate-400 hover:text-brand group-hover:block"
            >
              +
            </button>
            <button
              type="button"
              onClick={() => onDeleteFolder(node.id, node.name)}
              title="폴더 삭제"
              className="hidden rounded px-1 text-xs text-slate-400 hover:text-red-500 group-hover:block"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {isAddingHere && (
        <div style={{ paddingLeft: 8 + (depth + 1) * 14 }}>
          <AddFolderInput {...rest} />
        </div>
      )}

      {node.children.length > 0 && (
        <ul className="space-y-0.5">
          {node.children.map((child) => (
            <FolderTreeItem
              key={child.id}
              node={child}
              depth={depth + 1}
              {...rest}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

function AddFolderInput({
  newFolderName,
  setNewFolderName,
  onAddFolder,
  onCancelAdd,
}: SectionProps) {
  return (
    <div className="my-1 flex items-center gap-1 px-2">
      <input
        autoFocus
        type="text"
        value={newFolderName}
        onChange={(e) => setNewFolderName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onAddFolder();
          } else if (e.key === "Escape") {
            onCancelAdd();
          }
        }}
        placeholder="새 폴더 이름"
        maxLength={30}
        className="w-full rounded border border-sky-200 bg-white px-2 py-1 text-xs text-slate-700 focus:border-brand focus:outline-none"
      />
      <button
        type="button"
        onClick={onAddFolder}
        className="rounded border border-sky-200 px-2 py-1 text-xs text-slate-600 hover:border-brand hover:text-brand"
      >
        ✓
      </button>
      <button
        type="button"
        onClick={onCancelAdd}
        className="rounded px-1 text-xs text-slate-400 hover:text-slate-600"
      >
        ✕
      </button>
    </div>
  );
}
