import type { NoteNode } from "@/types/note";

/** Ancestor chain leading to targetId, inclusive (root first, target last). */
export function findNodePath(
  nodes: NoteNode[],
  targetId: string,
  acc: NoteNode[] = [],
): NoteNode[] | null {
  for (const node of nodes) {
    const path = [...acc, node];
    if (node.id === targetId) return path;
    const found = findNodePath(node.children, targetId, path);
    if (found) return found;
  }
  return null;
}

/** Pre-order depth-first list of node ids (stable tree walk). */
export function flattenPreorderIds(nodes: NoteNode[]): string[] {
  const out: string[] = [];
  function walk(list: NoteNode[]) {
    for (const n of list) {
      out.push(n.id);
      walk(n.children);
    }
  }
  walk(nodes);
  return out;
}

export function getPrevNodeId(nodes: NoteNode[], nodeId: string): string | null {
  const flat: string[] = [];
  function walk(list: NoteNode[]) {
    for (const node of list) {
      flat.push(node.id);
      walk(node.children);
    }
  }
  walk(nodes);
  const idx = flat.indexOf(nodeId);
  return idx > 0 ? flat[idx - 1] : null;
}

export function mapTree(
  nodes: NoteNode[],
  fn: (node: NoteNode, parent: NoteNode | null, index: number) => NoteNode | null,
): NoteNode[] {
  function walk(current: NoteNode[], parent: NoteNode | null): NoteNode[] {
    const result: NoteNode[] = [];
    for (let i = 0; i < current.length; i += 1) {
      const mapped = fn(current[i], parent, i);
      if (mapped) {
        result.push({ ...mapped, children: walk(mapped.children, mapped) });
      }
    }
    return result;
  }
  return walk(nodes, null);
}

export function indentNode(root: NoteNode[], nodeId: string): NoteNode[] {
  function walk(nodes: NoteNode[]): NoteNode[] {
    let changed = false;
    const next: NoteNode[] = [];

    for (let i = 0; i < nodes.length; i += 1) {
      const node = nodes[i];
      if (node.id === nodeId) {
        if (i === 0) {
          const deepChildren = walk(node.children);
          next.push(deepChildren === node.children ? node : { ...node, children: deepChildren });
        } else {
          changed = true;
          const prevSibling = next[next.length - 1];
          const movedNode = { ...node, children: walk(node.children) };
          next[next.length - 1] = {
            ...prevSibling,
            collapsed: false,
            children: [...prevSibling.children, movedNode],
          };
        }
        continue;
      }

      const deepChildren = walk(node.children);
      if (deepChildren !== node.children) changed = true;
      next.push(deepChildren === node.children ? node : { ...node, children: deepChildren });
    }

    return changed ? next : nodes;
  }
  return walk(root);
}

export function unindentNode(root: NoteNode[], nodeId: string): NoteNode[] {
  if (root.some((node) => node.id === nodeId)) {
    return root;
  }

  function walk(nodes: NoteNode[]): NoteNode[] {
    for (let i = 0; i < nodes.length; i += 1) {
      const node = nodes[i];
      const childIdx = node.children.findIndex((child) => child.id === nodeId);
      if (childIdx !== -1) {
        const target = node.children[childIdx];
        const laterSiblings = node.children.slice(childIdx + 1);
        const lifted: NoteNode = {
          ...target,
          children: [...target.children, ...laterSiblings],
        };
        const updatedParent: NoteNode = {
          ...node,
          children: node.children.slice(0, childIdx),
        };
        return [
          ...nodes.slice(0, i),
          updatedParent,
          lifted,
          ...nodes.slice(i + 1),
        ];
      }
    }

    let changed = false;
    const deep = nodes.map((node) => {
      const walkedChildren = walk(node.children);
      if (walkedChildren !== node.children) {
        changed = true;
        return { ...node, children: walkedChildren };
      }
      return node;
    });

    return changed ? deep : nodes;
  }

  return walk(root);
}

/** Insert `newNodes` as siblings immediately after `targetId` at the same depth; `null` appends at root. */
export function insertSiblingNodesAfter(
  root: NoteNode[],
  targetId: string | null,
  newNodes: NoteNode[],
): NoteNode[] {
  if (newNodes.length === 0) return root;
  if (targetId === null) {
    return [...root, ...newNodes];
  }
  function walk(list: NoteNode[]): NoteNode[] {
    const idx = list.findIndex((n) => n.id === targetId);
    if (idx !== -1) {
      return [...list.slice(0, idx + 1), ...newNodes, ...list.slice(idx + 1)];
    }
    let changed = false;
    const next = list.map((n) => {
      const c = walk(n.children);
      if (c !== n.children) {
        changed = true;
        return { ...n, children: c };
      }
      return n;
    });
    return changed ? next : list;
  }
  return walk(root);
}
