import type { Folder } from "./supabase";

export type FolderNode = Folder & { children: FolderNode[] };

/** Build a parent → children tree from a flat folder list. */
export function buildTree(folders: Folder[]): FolderNode[] {
  const map = new Map<string, FolderNode>();
  for (const f of folders) map.set(f.id, { ...f, children: [] });
  const roots: FolderNode[] = [];
  for (const f of folders) {
    const node = map.get(f.id)!;
    if (f.parent_id && map.has(f.parent_id)) {
      map.get(f.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

/**
 * Collect a folder id and all of its descendants in a single array.
 * Used when filtering posts by a folder so child-folder posts also
 * show up — that's the natural reading order for nested chapters.
 */
export function descendantIds(folders: Folder[], rootId: string): string[] {
  const result: string[] = [rootId];
  const childrenByParent = new Map<string, string[]>();
  for (const f of folders) {
    if (!f.parent_id) continue;
    const list = childrenByParent.get(f.parent_id) ?? [];
    list.push(f.id);
    childrenByParent.set(f.parent_id, list);
  }
  let frontier = [rootId];
  while (frontier.length) {
    const next: string[] = [];
    for (const id of frontier) {
      const kids = childrenByParent.get(id) ?? [];
      for (const k of kids) {
        result.push(k);
        next.push(k);
      }
    }
    frontier = next;
  }
  return result;
}
