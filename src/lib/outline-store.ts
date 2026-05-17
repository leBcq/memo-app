import type { OutlineNode } from "@/types/outline";

const makeId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

export const createNode = (contentHtml = ""): OutlineNode => ({
  id: makeId(),
  contentHtml,
  collapsed: false,
  children: [],
});

const updateNodeById = (
  nodes: OutlineNode[],
  targetId: string,
  updater: (node: OutlineNode) => OutlineNode,
): OutlineNode[] =>
  nodes.map((node) => {
    if (node.id === targetId) {
      return updater(node);
    }

    if (node.children.length === 0) {
      return node;
    }

    return {
      ...node,
      children: updateNodeById(node.children, targetId, updater),
    };
  });

const insertNodeById = (
  nodes: OutlineNode[],
  targetId: string,
  mode: "child" | "sibling",
  newNode: OutlineNode,
): OutlineNode[] => {
  const result: OutlineNode[] = [];

  for (const node of nodes) {
    if (node.id === targetId && mode === "child") {
      result.push({
        ...node,
        collapsed: false,
        children: [...node.children, newNode],
      });
      continue;
    }

    result.push(node);

    if (node.id === targetId && mode === "sibling") {
      result.push(newNode);
      continue;
    }

    if (node.children.length > 0) {
      const updatedChildren = insertNodeById(
        node.children,
        targetId,
        mode,
        newNode,
      );
      if (updatedChildren !== node.children) {
        result[result.length - 1] = { ...node, children: updatedChildren };
      }
    }
  }

  if (result.length === nodes.length && mode === "sibling") {
    return nodes;
  }

  return result;
};

const removeNodeById = (nodes: OutlineNode[], targetId: string): OutlineNode[] =>
  nodes
    .filter((node) => node.id !== targetId)
    .map((node) => ({
      ...node,
      children: removeNodeById(node.children, targetId),
    }));

export const outlineActions = {
  setContent(nodes: OutlineNode[], targetId: string, contentHtml: string) {
    return updateNodeById(nodes, targetId, (node) => ({ ...node, contentHtml }));
  },
  toggleCollapsed(nodes: OutlineNode[], targetId: string) {
    return updateNodeById(nodes, targetId, (node) => ({
      ...node,
      collapsed: !node.collapsed,
    }));
  },
  addChild(nodes: OutlineNode[], targetId: string) {
    return insertNodeById(nodes, targetId, "child", createNode());
  },
  addSibling(nodes: OutlineNode[], targetId: string) {
    return insertNodeById(nodes, targetId, "sibling", createNode());
  },
  remove(nodes: OutlineNode[], targetId: string) {
    return removeNodeById(nodes, targetId);
  },
};
