"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { mapTree, indentNode, unindentNode, getPrevNodeId } from "@/lib/treeUtils";
import type { HeadingLevel, NoteNode } from "@/types/note";
import { createNode, normalizeNode } from "@/types/note";

const STORAGE_KEY = "geo-memo-v2";

const defaultNodes = [
  createNode({ content: "Prototype memo" }),
  createNode({ content: "Type to expand infinitely" }),
];

const getInitialNodes = (): NoteNode[] => {
  if (typeof window === "undefined") {
    return defaultNodes;
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultNodes;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return defaultNodes;
    return parsed.map((node) => normalizeNode(node as Partial<NoteNode>));
  } catch {
    return defaultNodes;
  }
};

export function useNoteEditor() {
  // Start with static defaults so SSR and initial CSR output match.
  const [nodes, setNodes] = useState<NoteNode[]>(defaultNodes);
  const [isHydrated, setIsHydrated] = useState(false);
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;

  // Load from localStorage after mount.
  useEffect(() => {
    setNodes(getInitialNodes());
    setIsHydrated(true);
  }, []);

  // Save only after hydration to avoid clobbering stored data with defaults.
  useEffect(() => {
    if (!isHydrated) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nodesRef.current));
  }, [nodes, isHydrated]);

  const focusNode = useCallback((nodeId: string) => {
    const el = document.querySelector<HTMLElement>(
      `[data-node-id="${nodeId}"] [data-geo-editor="body"]`,
    );
    if (!el) return;
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  }, []);

  const deleteNodeAndFocusPrev = useCallback(
    (nodeId: string) => {
      const prevId = getPrevNodeId(nodes, nodeId);
      setNodes((prev) => {
        const removeRecursive = (current: NoteNode[]): NoteNode[] => {
          const filtered = current.filter((n) => n.id !== nodeId);
          if (filtered.length !== current.length) return filtered;
          return current.map((n) => ({ ...n, children: removeRecursive(n.children) }));
        };
        return removeRecursive(prev);
      });
      if (prevId) {
        requestAnimationFrame(() => focusNode(prevId));
      }
    },
    [nodes, focusNode],
  );

  const setNodeContent = useCallback((nodeId: string, content: string) => {
    setNodes((prev) =>
      mapTree(prev, (node) => (node.id === nodeId ? { ...node, content } : node)),
    );
  }, []);

  const toggleCollapsed = useCallback((nodeId: string) => {
    setNodes((prev) =>
      mapTree(prev, (node) =>
        node.id === nodeId ? { ...node, collapsed: !node.collapsed } : node,
      ),
    );
  }, []);

  const addChild = useCallback((nodeId: string) => {
    setNodes((prev) =>
      mapTree(prev, (node) =>
        node.id === nodeId
          ? { ...node, collapsed: false, children: [...node.children, createNode()] }
          : node,
      ),
    );
  }, []);

  const addSibling = useCallback((nodeId: string) => {
    const newNode = createNode();

    setNodes((prev) => {
      const insertAfter = (current: NoteNode[]): NoteNode[] => {
        const idx = current.findIndex((node) => node.id === nodeId);
        if (idx !== -1) {
          return [...current.slice(0, idx + 1), newNode, ...current.slice(idx + 1)];
        }
        return current.map((node) => ({
          ...node,
          children: insertAfter(node.children),
        }));
      };

      return insertAfter(prev);
    });

    requestAnimationFrame(() => {
      focusNode(newNode.id);
    });
  }, [focusNode]);

  const removeNode = useCallback((nodeId: string) => {
    const removeRecursive = (current: NoteNode[]): NoteNode[] => {
      let changed = false;
      const filtered = current
        .filter((node) => {
          const keep = node.id !== nodeId;
          if (!keep) changed = true;
          return keep;
        })
        .map((node) => {
          const nextChildren = removeRecursive(node.children);
          if (nextChildren !== node.children) {
            changed = true;
            return { ...node, children: nextChildren };
          }
          return node;
        });

      return changed ? filtered : current;
    };

    setNodes((prev) => removeRecursive(prev));
  }, []);

  const handleIndent = useCallback((nodeId: string) => {
    setNodes((prev) => indentNode(prev, nodeId));
  }, []);

  const handleUnindent = useCallback((nodeId: string) => {
    setNodes((prev) => unindentNode(prev, nodeId));
  }, []);

  const toggleCompleted = useCallback((nodeId: string) => {
    setNodes((prev) =>
      mapTree(prev, (node) =>
        node.id === nodeId ? { ...node, completed: !node.completed } : node,
      ),
    );
  }, []);

  const toggleHasCheckbox = useCallback((nodeId: string) => {
    setNodes((prev) =>
      mapTree(prev, (node) => {
        if (node.id !== nodeId) return node;
        return {
          ...node,
          hasCheckbox: !node.hasCheckbox,
          completed: node.hasCheckbox ? false : node.completed,
        };
      }),
    );
  }, []);

  const setNote = useCallback((nodeId: string, text: string | null) => {
    setNodes((prev) =>
      mapTree(prev, (node) => (node.id === nodeId ? { ...node, note: text } : node)),
    );
  }, []);

  const toggleNote = useCallback((nodeId: string) => {
    setNodes((prev) =>
      mapTree(prev, (node) =>
        node.id === nodeId
          ? { ...node, note: node.note === null ? "" : null }
          : node,
      ),
    );
  }, []);

  const setNodeBgColor = useCallback((nodeId: string, color: string | null) => {
    setNodes((prev) =>
      mapTree(prev, (node) => (node.id === nodeId ? { ...node, bgColor: color } : node)),
    );
  }, []);

  const setNodeHeading = useCallback((nodeId: string, level: HeadingLevel) => {
    setNodes((prev) =>
      mapTree(prev, (node) =>
        node.id === nodeId ? { ...node, headingLevel: level } : node,
      ),
    );
  }, []);

  return {
    nodes,
    setNodeContent,
    toggleCollapsed,
    addChild,
    addSibling,
    removeNode,
    deleteNodeAndFocusPrev,
    handleIndent,
    handleUnindent,
    toggleCompleted,
    toggleHasCheckbox,
    setNote,
    toggleNote,
    setNodeBgColor,
    setNodeHeading,
  };
}
