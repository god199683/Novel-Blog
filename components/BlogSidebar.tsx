"use client";

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase, type Category, type Folder } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import { buildTree, descendantIds, type FolderNode } from "@/lib/folders";

type Props = {
  username: string;
  isOwner: boolean;
  initialCategories: Category[];
  initialFolders: Folder[];
  selectedCategory: string | null;
  selectedFolder: string | null;
  onChange: (updates: { categories?: Category[]; folders?: Folder[] }) => void;
};

type AddTarget =
  | { kind: "category"; category: string | null }
  | { kind: "folder"; parentId: string; category: string | null };

// 드래그 중인 드롭 타겟 표시용
type DropHint =
  | { kind: "folder"; id: string; position: "before" | "into" | "after" }
  | { kind: "category"; category: string | null };

const DRAG_TYPE = "application/x-folder-id";

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
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropHint, setDropHint] = useState<DropHint | null>(null);

  useEffect(() => setCats(initialCategories), [initialCategories]);
  useEffect(() => setFls(initialFolders), [initialFolders]);

  const tree = useMemo(() => buildTree(fls), [fls]);

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

  // ---------- 카테고리 CRUD ----------
  const addCategory = async () => {
    const name = newCat.trim();
    if (!name || !user) return;
    const { data, error } = await supabase()
      .from("categories")
      .insert({ user_id: user.id, name, sort_order: cats.length })
      .select()
      .single();
    if (error) return alert(error.message);
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
    if (error) return alert(error.message);
    const updated = cats.filter((c) => c.id !== id);
    setCats(updated);
    onChange({ categories: updated });
  };

  // ---------- 폴더 CRUD ----------
  const beginAdd = (target: AddTarget) => {
    setAddTarget(target);
    setNewFolderName("");
  };

  const addFolder = async () => {
    const name = newFolderName.trim();
    if (!name || !user || !addTarget) return;
    const payload = {
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
    if (error) return alert(error.message);
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
    if (error) return alert(error.message);
    const updated = fls
      .filter((f) => f.id !== id)
      .map((f) => (f.parent_id === id ? { ...f, parent_id: null } : f));
    setFls(updated);
    onChange({ folders: updated });
  };

  // ---------- 드래그 앤 드롭 ----------
  // 같은 부모 그룹 내 sort_order를 0,1,2,...로 다시 매김.
  const renumberAndPersist = async (allFolders: Folder[]) => {
    // 부모(parent_id, category) 키별로 sort_order 재할당
    type Group = string;
    const groupKey = (f: Folder): Group =>
      `${f.parent_id ?? "_root"}::${f.category ?? "_none"}`;
    const groups = new Map<Group, Folder[]>();
    for (const f of allFolders) {
      const k = groupKey(f);
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k)!.push(f);
    }
    const updates: Folder[] = [];
    for (const list of groups.values()) {
      list.sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
      list.forEach((f, i) => {
        if (f.sort_order !== i) updates.push({ ...f, sort_order: i });
      });
    }
    if (updates.length === 0) return allFolders;
    const sb = supabase();
    // 변경된 것만 개별 업데이트
    await Promise.all(
      updates.map((u) =>
        sb.from("folders").update({ sort_order: u.sort_order }).eq("id", u.id)
      )
    );
    const updatedMap = new Map(updates.map((u) => [u.id, u.sort_order]));
    return allFolders.map((f) =>
      updatedMap.has(f.id) ? { ...f, sort_order: updatedMap.get(f.id)! } : f
    );
  };

  // 드롭으로 폴더를 새 부모/카테고리/위치로 이동
  const moveFolder = async (
    draggedId: string,
    target: {
      newParentId: string | null;
      newCategory: string | null;
      // 같은 그룹 안에서 어느 위치에 끼울지(0=맨 앞, 그룹크기=맨 뒤)
      insertIndex: number;
    }
  ) => {
    if (descendantIds(fls, draggedId).includes(target.newParentId ?? "")) {
      // 자기 자신/하위로 이동 금지
      return;
    }
    const dragged = fls.find((f) => f.id === draggedId);
    if (!dragged) return;

    // 1) 새 그룹의 형제 목록 만들기 (옮겨지는 본인 제외)
    const newSiblings = fls
      .filter(
        (f) =>
          f.id !== draggedId &&
          (f.parent_id ?? null) === target.newParentId &&
          (f.category ?? null) === target.newCategory
      )
      .sort((a, b) => a.sort_order - b.sort_order);

    // 2) insertIndex 위치에 dragged 삽입한 새 순서대로 sort_order 재할당
    const reordered = [
      ...newSiblings.slice(0, target.insertIndex),
      { ...dragged, parent_id: target.newParentId, category: target.newCategory },
      ...newSiblings.slice(target.insertIndex),
    ].map((f, i) => ({ ...f, sort_order: i }));

    // 3) 로컬 상태 즉시 갱신 (낙관적 업데이트)
    const reorderedMap = new Map(reordered.map((f) => [f.id, f]));
    const optimistic = fls.map((f) => reorderedMap.get(f.id) ?? f);
    setFls(optimistic);
    onChange({ folders: optimistic });

    // 4) DB 반영 — dragged 폴더의 parent/category/sort_order + 형제 sort_order 갱신
    const sb = supabase();
    await Promise.all(
      reordered.map((f) =>
        sb
          .from("folders")
          .update({
            parent_id: f.parent_id,
            category: f.category,
            sort_order: f.sort_order,
          })
          .eq("id", f.id)
      )
    );
  };

  const onDragStart = (e: React.DragEvent, folderId: string) => {
    e.dataTransfer.setData(DRAG_TYPE, folderId);
    e.dataTransfer.effectAllowed = "move";
    setDraggingId(folderId);
  };

  const onDragEndGlobal = () => {
    setDraggingId(null);
    setDropHint(null);
  };

  // 드래그 오버 시 영역의 위/중/아래에 따라 위치 결정
  const computeFolderHint = (
    e: React.DragEvent,
    folderId: string
  ): { kind: "folder"; id: string; position: "before" | "into" | "after" } => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const y = e.clientY - rect.top;
    const ratio = y / rect.height;
    let position: "before" | "into" | "after";
    if (ratio < 0.25) position = "before";
    else if (ratio > 0.75) position = "after";
    else position = "into";
    return { kind: "folder", id: folderId, position };
  };

  const onFolderDragOver = (e: React.DragEvent, folderId: string) => {
    if (!draggingId) return;
    if (draggingId === folderId) return;
    if (descendantIds(fls, draggingId).includes(folderId)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDropHint(computeFolderHint(e, folderId));
  };

  const onFolderDrop = async (e: React.DragEvent, folderId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const draggedId = e.dataTransfer.getData(DRAG_TYPE);
    setDropHint(null);
    setDraggingId(null);
    if (!draggedId || draggedId === folderId) return;
    if (descendantIds(fls, draggedId).includes(folderId)) return;

    const hint = computeFolderHint(e, folderId);
    const target = fls.find((f) => f.id === folderId);
    if (!target) return;

    if (hint.position === "into") {
      // 새 부모 = target, 카테고리는 target과 동일, 끝에 추가
      const childCount = fls.filter(
        (f) => f.parent_id === target.id
      ).length;
      await moveFolder(draggedId, {
        newParentId: target.id,
        newCategory: target.category,
        insertIndex: childCount,
      });
    } else {
      // 같은 부모 그룹의 형제로 끼워넣기
      const newParentId = target.parent_id ?? null;
      const newCategory = target.category ?? null;
      const siblings = fls
        .filter(
          (f) =>
            f.id !== draggedId &&
            (f.parent_id ?? null) === newParentId &&
            (f.category ?? null) === newCategory
        )
        .sort((a, b) => a.sort_order - b.sort_order);
      const targetIdx = siblings.findIndex((f) => f.id === target.id);
      const insertIndex =
        hint.position === "before" ? targetIdx : targetIdx + 1;
      await moveFolder(draggedId, {
        newParentId,
        newCategory,
        insertIndex: Math.max(0, insertIndex),
      });
    }
  };

  const onCategoryDragOver = (
    e: React.DragEvent,
    category: string | null
  ) => {
    if (!draggingId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDropHint({ kind: "category", category });
  };

  const onCategoryDrop = async (
    e: React.DragEvent,
    category: string | null
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const draggedId = e.dataTransfer.getData(DRAG_TYPE);
    setDropHint(null);
    setDraggingId(null);
    if (!draggedId) return;
    // 카테고리 헤더에 드롭 = 그 카테고리 최상위로 (parent_id=null)
    const siblings = fls.filter(
      (f) =>
        f.id !== draggedId &&
        f.parent_id === null &&
        (f.category ?? null) === category
    );
    await moveFolder(draggedId, {
      newParentId: null,
      newCategory: category,
      insertIndex: siblings.length,
    });
  };

  const sectionProps = {
    username,
    isOwner,
    selectedCategory,
    selectedFolder,
    addTarget,
    newFolderName,
    setNewFolderName,
    onBeginAdd: beginAdd,
    onCancelAdd: () => setAddTarget(null),
    onAddFolder: addFolder,
    onDeleteFolder: deleteFolder,
    draggingId,
    dropHint,
    onDragStart,
    onDragEnd: onDragEndGlobal,
    onFolderDragOver,
    onFolderDrop,
    onCategoryDragOver,
    onCategoryDrop,
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
            roots={rootByCategory.get(c.name) ?? []}
            allFolders={fls}
            onDeleteCategory={() => deleteCategory(c.id, c.name)}
            {...sectionProps}
          />
        ))}

        {(hasUnclassified || isOwner) && (
          <CategorySection
            categoryName={null}
            roots={rootByCategory.get(null) ?? []}
            allFolders={fls}
            {...sectionProps}
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
//  Section + Tree 컴포넌트
// =====================================================================

type SectionProps = {
  categoryName: string | null;
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
  draggingId: string | null;
  dropHint: DropHint | null;
  onDragStart: (e: React.DragEvent, folderId: string) => void;
  onDragEnd: () => void;
  onFolderDragOver: (e: React.DragEvent, folderId: string) => void;
  onFolderDrop: (e: React.DragEvent, folderId: string) => Promise<void>;
  onCategoryDragOver: (e: React.DragEvent, category: string | null) => void;
  onCategoryDrop: (e: React.DragEvent, category: string | null) => Promise<void>;
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
    dropHint,
    onCategoryDragOver,
    onCategoryDrop,
  } = props;

  const isAddingHere =
    addTarget?.kind === "category" && addTarget.category === categoryName;
  const isCategoryDropTarget =
    dropHint?.kind === "category" && dropHint.category === categoryName;

  return (
    <div>
      <div
        onDragOver={(e) => onCategoryDragOver(e, categoryName)}
        onDrop={(e) => onCategoryDrop(e, categoryName)}
        className={`group flex items-center justify-between rounded ${
          isCategoryDropTarget ? "bg-brand-light/40 ring-1 ring-brand" : ""
        }`}
      >
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
    draggingId,
    dropHint,
    onDragStart,
    onDragEnd,
    onFolderDragOver,
    onFolderDrop,
  } = rest;

  const isAddingHere =
    addTarget?.kind === "folder" && addTarget.parentId === node.id;
  const isDragging = draggingId === node.id;
  const folderHint =
    dropHint?.kind === "folder" && dropHint.id === node.id
      ? dropHint
      : null;

  return (
    <li>
      {/* 위쪽 드롭 라인 */}
      {folderHint?.position === "before" && (
        <div
          className="mx-2 my-0.5 h-0.5 rounded bg-brand"
          style={{ marginLeft: 8 + depth * 14 }}
        />
      )}

      <div
        draggable={isOwner}
        onDragStart={(e) => onDragStart(e, node.id)}
        onDragEnd={onDragEnd}
        onDragOver={(e) => onFolderDragOver(e, node.id)}
        onDrop={(e) => onFolderDrop(e, node.id)}
        className={`group flex items-center justify-between rounded ${
          isDragging ? "opacity-40" : ""
        } ${
          folderHint?.position === "into"
            ? "bg-brand-light/40 ring-1 ring-brand"
            : ""
        }`}
      >
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

      {/* 아래쪽 드롭 라인 */}
      {folderHint?.position === "after" && (
        <div
          className="mx-2 my-0.5 h-0.5 rounded bg-brand"
          style={{ marginLeft: 8 + depth * 14 }}
        />
      )}

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
